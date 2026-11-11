import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { addTagByName } from "@/lib/crm/add-tag";
import { upsertActivity } from "@/lib/crm/activities";

// A sign-up from heyjasminebrown.com (e.g. /conference). Shared by the
// /api/leads endpoint and the "Import webinar sign-ups from Gmail" repair.
//
// Creates a NEW contact only when the email isn't anywhere in the CRM yet
// (primary or secondary email, archived contacts included). New contacts
// are Type Community, Stage Warm. Someone already in the CRM is left as is.

export type WebsiteLeadInput = {
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  source: string;
  tags?: string[];
  form: string;
  // When they signed up (defaults to now).
  signedUpAt?: string;
};

export type WebsiteLeadResult = { created: true; contactId: string } | { created: false; reason: "email already in CRM" };

// ILIKE pattern that matches only this exact text (case-insensitive).
function exactPattern(value: string) {
  return `"${value.replace(/[\\%_"]/g, (c) => `\\${c}`)}"`;
}

export async function addWebsiteLead(admin: SupabaseClient, ownerId: string, input: WebsiteLeadInput): Promise<WebsiteLeadResult> {
  const email = input.email.trim().toLowerCase();

  const pattern = exactPattern(email);
  const { data: existing, error: lookupError } = await admin
    .from("contacts")
    .select("id, email, secondary_email")
    .eq("owner_id", ownerId)
    .or(`email.ilike.${pattern},secondary_email.ilike.${pattern}`)
    .limit(5);
  if (lookupError) throw new Error(`Couldn't check for an existing contact: ${lookupError.message}`);
  if ((existing ?? []).some((c) => [c.email, c.secondary_email].some((e) => e && e.trim().toLowerCase() === email))) {
    return { created: false, reason: "email already in CRM" };
  }

  const { data: stages, error: stageError } = await admin.from("pipeline_stages").select("id, name").eq("owner_id", ownerId);
  if (stageError) throw new Error(`Couldn't load stages: ${stageError.message}`);
  const warm = stages?.find((s) => s.name.trim().toLowerCase() === "warm");
  if (!warm) throw new Error("There's no Warm stage");

  const signedUpAt = input.signedUpAt ?? new Date().toISOString();
  const contact = await findOrCreateContact(admin, ownerId, {
    email,
    phone: input.phone?.trim() || null,
    firstName: input.firstName.trim(),
    lastName: input.lastName?.trim() || null,
    leadSource: input.source,
    relationshipType: "community",
    stageId: warm.id,
    leadDate: signedUpAt,
    // Email uniqueness was checked above; always create.
    candidates: [],
  });
  if (!contact) throw new Error("The contact couldn't be created");

  for (const tag of input.tags ?? []) await addTagByName(admin, ownerId, contact.id, tag);
  await upsertActivity(admin, ownerId, contact.id, "site_form", "site_form_signup", `${contact.id}:${input.form}`, {
    type: "note",
    direction: "none",
    occurred_at: signedUpAt,
    body: `Signed up on ${input.form}`,
    metadata: { form: input.form, source: input.source },
  });
  return { created: true, contactId: contact.id };
}
