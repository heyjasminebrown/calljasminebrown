import type { SupabaseClient } from "@supabase/supabase-js";

// Shared write path for dismissed_insights - used by Sphere's review
// requests and Insights' cards alike. Not a plain upsert: uniqueness on
// this table lives in two partial indexes (contact_id null vs not-null,
// see migration 0036's comment), and Postgres can only target a partial
// index in an ON CONFLICT clause when the predicate is repeated there
// too, which the Supabase JS client's upsert() has no way to express.
// Select-then-write instead - this table is written to rarely enough
// (a person clicking Dismiss) that the extra round trip is a non-issue.
export async function writeDismissal(
  supabase: SupabaseClient,
  ownerId: string,
  key: string,
  contactId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  let query = supabase.from("dismissed_insights").select("id").eq("owner_id", ownerId).eq("insight_key", key);
  query = contactId ? query.eq("contact_id", contactId) : query.is("contact_id", null);
  const { data: existing, error: readError } = await query.maybeSingle();
  if (readError) return { ok: false, error: readError.message };

  if (existing) {
    const { error } = await supabase.from("dismissed_insights").update({ dismissed_at: now }).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("dismissed_insights").insert({ owner_id: ownerId, insight_key: key, contact_id: contactId, dismissed_at: now });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// A dismissal counts as still active if it's younger than windowDays -
// pass 30 for the standard Insights rule, a shorter window for something
// like Sphere's "ask me again in a week" snooze.
export function isDismissedWithin(dismissedAt: string | undefined, windowDays: number): boolean {
  if (!dismissedAt) return false;
  return Date.now() - new Date(dismissedAt).getTime() < windowDays * 24 * 60 * 60 * 1000;
}
