import type { SupabaseClient } from "@supabase/supabase-js";
import { phonesMatch } from "@/lib/phone";
import { syncContactToQuo } from "@/lib/quo/sync-contact";
import { hasPlaceholderName } from "@/lib/crm/merge-fields";
import { reportFailure } from "@/lib/errors/report-failure";
import { DEFAULT_STAGE_NAME } from "@/lib/utils";
import type { RelationshipType } from "@/types/database";

export type MatchCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  secondary_email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  quo_contact_id: string | null;
  relationship_type: RelationshipType;
  stage_id: string | null;
};

const MATCH_COLUMNS = "id, first_name, last_name, email, secondary_email, phone, secondary_phone, quo_contact_id, relationship_type, stage_id";
const PAGE_SIZE = 1000;

// Every non-archived contact, paged - a single select is capped at 1000
// rows by Supabase, which silently hid anyone past that from matching and
// let them be re-created as duplicates.
export async function loadMatchCandidates(client: SupabaseClient, ownerId: string): Promise<MatchCandidate[]> {
  const all: MatchCandidate[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("contacts")
      .select(MATCH_COLUMNS)
      .eq("owner_id", ownerId)
      .eq("archived", false)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't load contacts to check for duplicates: ${error.message}`);
    all.push(...((data ?? []) as MatchCandidate[]));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}

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
    // Only CSV import supplies this; stored, never used to match on its own.
    secondaryEmail?: string | null;
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
    // Bulk import loads the contact list once and passes it in, instead of
    // re-reading every contact for every row. Newly created contacts are
    // appended so later rows in the same import match them.
    candidates?: MatchCandidate[];
    // New contacts only. Type defaults to Community (the column default);
    // stage defaults to Nurture. Pass stageId: null for no stage.
    relationshipType?: RelationshipType;
    stageId?: string | null;
    // Matched contacts only: let a different incoming email replace the
    // Secondary email even when one is already saved (Eventbrite - the
    // latest registration email is the one they're using now). The
    // primary email is never replaced.
    replaceSecondaryEmail?: boolean;
  },
): Promise<{ id: string; wasCreated: boolean; existing?: MatchCandidate } | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const secondaryEmail = input.secondaryEmail?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;
  if (!email && !phone) return null;

  const candidates = input.candidates ?? (await loadMatchCandidates(admin, ownerId));

  const match = candidates.find((c) => {
    const emailMatch = email && [c.email, c.secondary_email].some((e) => e && e.trim().toLowerCase() === email);
    const phoneMatch = phone && (phonesMatch(c.phone, phone) || phonesMatch(c.secondary_phone, phone));
    return emailMatch || phoneMatch;
  });
  if (match) {
    await enrichContact(admin, match, {
      email,
      secondaryEmail,
      phone,
      firstName: input.firstName,
      lastName: input.lastName,
      replaceSecondaryEmail: input.replaceSecondaryEmail,
    });
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
    return { id: match.id, wasCreated: false, existing: match };
  }

  let stageId = input.stageId;
  if (stageId === undefined) {
    const { data: stages } = await admin.from("pipeline_stages").select("id, name").eq("owner_id", ownerId).order("sort_order");
    stageId = (stages?.find((s) => s.name === DEFAULT_STAGE_NAME) ?? stages?.[0])?.id ?? null;
  }

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      owner_id: ownerId,
      first_name: input.firstName?.trim() || email || phone || "Unknown",
      last_name: input.lastName?.trim() || "",
      email,
      secondary_email: secondaryEmail,
      phone,
      contact_type: input.contactType ?? "other",
      lead_source: input.leadSource,
      stage_id: stageId,
      ...(input.relationshipType ? { relationship_type: input.relationshipType } : {}),
      ...(input.leadDate ? { lead_date: input.leadDate } : {}),
    })
    .select(MATCH_COLUMNS)
    .single();

  if (error || !created) {
    if (error) await reportFailure("Couldn't create contact", error.message);
    return null;
  }
  input.candidates?.push(created as MatchCandidate);

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
  contact: { id: string; first_name: string; last_name: string; email: string | null; secondary_email: string | null; phone: string | null },
  incoming: {
    email: string | null;
    secondaryEmail?: string | null;
    phone: string | null;
    firstName?: string | null;
    lastName?: string | null;
    replaceSecondaryEmail?: boolean;
  },
) {
  const patch: Record<string, string> = {};

  if (hasPlaceholderName(contact) && incoming.firstName?.trim()) {
    patch.first_name = incoming.firstName.trim();
    if (incoming.lastName?.trim()) patch.last_name = incoming.lastName.trim();
  }
  if (!contact.email && incoming.email) patch.email = incoming.email;
  if (!contact.phone && incoming.phone) patch.phone = incoming.phone;
  // A different email than the one on file (e.g. matched by phone, but they
  // registered with another address) goes into an empty Secondary email
  // rather than being dropped. An explicit secondary (CSV import) wins.
  const onFile = [contact.email, contact.secondary_email, patch.email].map((e) => e?.toLowerCase());
  const secondary = [incoming.secondaryEmail, incoming.email].find((e) => e && !onFile.includes(e.toLowerCase()));
  if (secondary && (!contact.secondary_email || incoming.replaceSecondaryEmail)) patch.secondary_email = secondary;

  if (Object.keys(patch).length > 0) {
    await admin.from("contacts").update(patch).eq("id", contact.id);
    Object.assign(contact, patch);
  }
}

// Kept here for existing imports; lives in add-tag.ts so browser-side code
// can use it without pulling in this module's server-only error reporting.
export { addTagByName } from "./add-tag";
