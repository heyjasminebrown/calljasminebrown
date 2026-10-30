import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailAudienceCriteria = {
  targetTagIds: string[];
  excludeTagIds: string[];
  excludeStageIds: string[];
  excludeTimelines: string[];
  // Batch sequences only: the frozen membership captured at creation time
  // (email_sequences.snapshot_contact_ids) - when set, this replaces the
  // live contact_tags lookup for targetTagIds entirely, so a one-off batch
  // send can never pick up someone tagged after it went out. The
  // exclude/opt-out/archived checks below still run live off this list,
  // since those should always reflect a contact's current state.
  memberIds?: string[];
};

export type SequenceContact = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  archived: boolean;
  unsubscribe_token: string;
};

export type EmailAudienceResult = {
  eligible: SequenceContact[];
  excludedCount: number; // archived, known personally, or matched an exclude tag/stage/timeline
  optedOutCount: number; // contacts.opted_out_at set (global STOP)
  noEmailCount: number; // matched the audience but has no email on file
};

const EMPTY: EmailAudienceResult = { eligible: [], excludedCount: 0, optedOutCount: 0, noEmailCount: 0 };

// The one place both the live audience preview (shown before sending)
// and the actual send (processBroadcastSequence in sequences.ts) resolve
// who's in scope, so what she previews is guaranteed to match what goes
// out - no second query that could quietly drift from the first. Anyone
// matching any of targetTagIds is a candidate; excluded if archived,
// known personally (same "don't auto-message someone I know" convention
// used elsewhere - see warm-notifications.ts), or matches an exclude
// tag/stage/timeline. Opted-out and no-email contacts are split out
// separately so the UI can explain exactly why the count isn't higher,
// same idea as text-blast-actions.ts's splitByOptOut - neither
// opted_out_at nor known_personally were ever checked by the old
// single-tag contact_tags join this replaces.
export async function resolveEmailAudience(
  admin: SupabaseClient,
  ownerId: string,
  criteria: EmailAudienceCriteria,
): Promise<EmailAudienceResult> {
  let includedIds: string[];
  if (criteria.memberIds) {
    includedIds = criteria.memberIds;
  } else {
    if (criteria.targetTagIds.length === 0) return EMPTY;
    const { data: memberRows } = await admin.from("contact_tags").select("contact_id").in("tag_id", criteria.targetTagIds);
    includedIds = [...new Set((memberRows ?? []).map((r) => r.contact_id as string))];
  }
  if (includedIds.length === 0) return EMPTY;

  const excludedByTag = new Set<string>();
  if (criteria.excludeTagIds.length > 0) {
    const { data } = await admin
      .from("contact_tags")
      .select("contact_id")
      .in("tag_id", criteria.excludeTagIds)
      .in("contact_id", includedIds);
    for (const r of data ?? []) excludedByTag.add(r.contact_id as string);
  }

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, email, first_name, last_name, archived, known_personally, opted_out_at, stage_id, timeline, unsubscribe_token")
    .eq("owner_id", ownerId)
    .in("id", includedIds);

  let excludedCount = 0;
  let optedOutCount = 0;
  let noEmailCount = 0;
  const eligible: SequenceContact[] = [];

  for (const c of contacts ?? []) {
    if (c.archived || c.known_personally) {
      excludedCount++;
      continue;
    }
    if (excludedByTag.has(c.id)) {
      excludedCount++;
      continue;
    }
    if (c.stage_id && criteria.excludeStageIds.includes(c.stage_id)) {
      excludedCount++;
      continue;
    }
    if (criteria.excludeTimelines.includes(c.timeline)) {
      excludedCount++;
      continue;
    }
    if (c.opted_out_at) {
      optedOutCount++;
      continue;
    }
    if (!c.email) {
      noEmailCount++;
      continue;
    }
    eligible.push({
      id: c.id,
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      archived: c.archived,
      unsubscribe_token: c.unsubscribe_token,
    });
  }

  return { eligible, excludedCount, optedOutCount, noEmailCount };
}
