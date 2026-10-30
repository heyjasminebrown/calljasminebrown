import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch } from "@/lib/phone";
import { syncContactToQuo } from "@/lib/quo/sync-contact";
import { hasPlaceholderName } from "@/lib/crm/merge-fields";

// Shared across integrations (Quo, Calendly, Eventbrite, Jotform): find an
// existing contact by email and/or phone, or create a bare one so nothing
// gets lost. Matching by either field means a contact created from one
// source (e.g. Eventbrite) still gets recognized by another (e.g. Jotform)
// instead of spawning a duplicate.
export async function findOrCreateContact(
  admin: SupabaseClient,
  ownerId: string,
  input: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    leadSource: string;
    contactType?: string;
    // The lead's real original date (booking/signup/registration), distinct
    // from created_at (when this row was inserted). Only ever passed by CSV
    // import, where the two can legitimately differ - every other source
    // creates the contact the same moment the lead came in, so leaving this
    // unset lets the column default to created_at.
    leadDate?: string | null;
    // Bulk imports process rows one at a time already (for dedup safety -
    // see the caller) and a Quo API round-trip per row risks timing out a
    // big CSV. Skip it there; the one-time backfill button in Settings
    // catches every contact this leaves un-synced.
    skipQuoSync?: boolean;
  },
): Promise<{ id: string; wasCreated: boolean } | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone) return null;

  const { data: candidates } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email, phone, secondary_phone, quo_contact_id")
    .eq("owner_id", ownerId)
    .eq("archived", false);

  const match = (candidates ?? []).find((c) => {
    const emailMatch = email && c.email && c.email.trim().toLowerCase() === email;
    const phoneMatch = phone && (phonesMatch(c.phone, phone) || phonesMatch(c.secondary_phone, phone));
    return emailMatch || phoneMatch;
  });
  if (match) {
    await enrichContact(admin, match, { email, phone, firstName: input.firstName, lastName: input.lastName });
    // A re-imported CSV (now carrying a date column that didn't exist on
    // the first import) is the intended way to backfill a wrong lead_date
    // on a contact created before this field existed - a deliberate,
    // user-initiated correction, not a silent overwrite from an unrelated
    // source (every other integration leaves leadDate unset).
    if (input.leadDate) await admin.from("contacts").update({ lead_date: input.leadDate }).eq("id", match.id);
    if (phone && !input.skipQuoSync) {
      await syncContactToQuo(admin, {
        id: match.id,
        first_name: input.firstName?.trim() || match.first_name,
        last_name: input.lastName?.trim() || match.last_name,
        phone,
        email,
        quo_contact_id: match.quo_contact_id,
      });
    }
    return { id: match.id, wasCreated: false };
  }

  const { data: firstStage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      owner_id: ownerId,
      first_name: input.firstName?.trim() || email || phone || "Unknown",
      last_name: input.lastName?.trim() || "",
      email,
      phone,
      contact_type: input.contactType ?? "other",
      lead_source: input.leadSource,
      stage_id: firstStage?.id ?? null,
      ...(input.leadDate ? { lead_date: input.leadDate } : {}),
    })
    .select("id")
    .single();

  if (error || !created) return null;

  if (phone && !input.skipQuoSync) {
    await syncContactToQuo(admin, {
      id: created.id,
      first_name: input.firstName?.trim() || email || phone || "Unknown",
      last_name: input.lastName?.trim() || "",
      phone,
      email,
    });
  }

  return { id: created.id, wasCreated: true };
}

// When a match is found, integrations often know more than what's on file
// yet - e.g. a contact auto-created from a bare phone number (Quo) has no
// name until a richer source (Eventbrite, Jotform, Calendly) hands us one.
// Only fills in genuinely missing/placeholder fields; never overwrites
// real data already on the contact.
async function enrichContact(
  admin: SupabaseClient,
  contact: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null },
  incoming: { email: string | null; phone: string | null; firstName?: string | null; lastName?: string | null },
) {
  const patch: Record<string, string> = {};

  if (hasPlaceholderName(contact) && incoming.firstName?.trim()) {
    patch.first_name = incoming.firstName.trim();
    if (incoming.lastName?.trim()) patch.last_name = incoming.lastName.trim();
  }
  if (!contact.email && incoming.email) patch.email = incoming.email;
  if (!contact.phone && incoming.phone) patch.phone = incoming.phone;

  if (Object.keys(patch).length > 0) {
    await admin.from("contacts").update(patch).eq("id", contact.id);
  }
}

export async function addTagByName(admin: SupabaseClient, ownerId: string, contactId: string, tagName: string): Promise<boolean> {
  let { data: tag } = await admin.from("tags").select("id").eq("owner_id", ownerId).eq("name", tagName).maybeSingle();

  if (!tag) {
    const { data: created } = await admin
      .from("tags")
      .insert({ owner_id: ownerId, name: tagName })
      .select("id")
      .maybeSingle();
    tag = created;
  }
  if (!tag) return false;

  const { error } = await admin.from("contact_tags").upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id" });
  return !error;
}
