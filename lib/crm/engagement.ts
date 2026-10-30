import type { SupabaseClient } from "@supabase/supabase-js";
import { addTagByName } from "./find-or-create-contact";

// "Engaged" = multiple calls/texts (either direction) in the trailing 7
// days, OR a genuine email interaction in the same window - recomputed
// right after logging each new call/text/email event rather than on a
// schedule, since the app is already event-driven off Quo/tracking-pixel
// webhooks and this avoids needing a cron job for something this
// lightweight.
const ENGAGEMENT_WINDOW_DAYS = 7;
const CALL_TEXT_THRESHOLD = 3;
const ENGAGED_TAG = "Engaged";

// A single "open" isn't trusted as a real signal - Gmail and Apple Mail
// Privacy Protection both pre-fetch tracking pixels automatically, so one
// open can happen with nobody ever having looked at the email. A click
// can't be auto-triggered that way (it takes an actual tap), and an email
// opened more than once looks like genuine re-reading rather than a single
// proxy pre-fetch, so either of those - not a lone open - counts as real
// email engagement. (Time-on-email isn't something a tracking pixel can
// measure at all, so it isn't part of this signal.)
async function hasRecentEmailEngagement(admin: SupabaseClient, contactId: string, since: string) {
  const { count } = await admin
    .from("email_sequence_sends")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .gte("sent_at", since)
    .or("click_count.gt.0,open_count.gt.1");
  return (count ?? 0) > 0;
}

export async function updateEngagementTag(admin: SupabaseClient, ownerId: string, contactId: string) {
  const since = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ count }, emailEngaged] = await Promise.all([
    admin
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .in("type", ["call", "text"])
      .gte("occurred_at", since),
    hasRecentEmailEngagement(admin, contactId, since),
  ]);

  const engaged = (count ?? 0) >= CALL_TEXT_THRESHOLD || emailEngaged;

  if (engaged) {
    await addTagByName(admin, ownerId, contactId, ENGAGED_TAG);
    return;
  }

  const { data: tag } = await admin.from("tags").select("id").eq("owner_id", ownerId).eq("name", ENGAGED_TAG).maybeSingle();
  if (tag) {
    await admin.from("contact_tags").delete().eq("contact_id", contactId).eq("tag_id", tag.id);
  }
}

// The mobile contact record shows a real count next to the "Engaged" tag
// ("Engaged · 4 texts this week") rather than just the boolean - same
// 7-day window as the tag above, but texts only (not the tag's
// call+text+email union), since that's the specific number the chip
// copy promises.
export async function countRecentTexts(admin: SupabaseClient, contactId: string): Promise<number> {
  const since = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .eq("type", "text")
    .gte("occurred_at", since);
  return count ?? 0;
}
