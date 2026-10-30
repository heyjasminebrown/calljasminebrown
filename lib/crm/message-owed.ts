import type { Activity } from "@/types/database";

export const MISSED_CALL_STATUSES = new Set(["missed", "no-answer", "no_answer", "busy", "voicemail"]);

// Unread / needs-reply / sidebar badge — one contract:
// A conversation counts iff conversationOwedFromHistory says owed
// (inbound text with needs_reply !== false, or a missed inbound call;
// later outbound text closes it; reply_dismissed_at clears it) AND
// listConversations included it (not archived, not spam-flagged, not a
// spam-like missed-call stub). Today "Messages N need a reply", the nav badge,
// and /messages "waiting on you" / Needs a reply all use that count.

export function isMissedCall(activity: Pick<Activity, "type" | "direction" | "metadata">): boolean {
  if (activity.type !== "call" || activity.direction !== "inbound") return false;
  const status = typeof activity.metadata?.status === "string" ? activity.metadata.status.toLowerCase() : null;
  return status != null && MISSED_CALL_STATUSES.has(status);
}

// One canonical answer to "does this thread need something from her" -
// reused by the Messages page's owed/not-owed split and the sidebar
// badge, instead of the three different definitions that used to exist
// (Today's text-only getRepliesOwedGroup, which already respected
// needs_reply; listConversations, which didn't look at it at all; and
// the sidebar badge, which used a third inbound-only check). A missed
// call counts as owed too - it gets its own "Call back" treatment on
// Messages, grouped into the same bucket.
//
// reply_dismissed_at is "I looked at this, I don't need to act on it" -
// a deliberate, per-message call, not a delete/spam/archive. It's
// checked here (not just in Today's own query) so dismissing a thread
// on Messages also clears it from Today's Replies owed and the sidebar
// badge, and vice versa - one predicate, one answer everywhere.
export function isConversationOwed(activity: Pick<Activity, "type" | "direction" | "needs_reply" | "metadata" | "reply_dismissed_at">): boolean {
  if (activity.reply_dismissed_at) return false;
  if (activity.type === "text") {
    return activity.direction === "inbound" && activity.needs_reply !== false;
  }
  if (activity.type === "call") {
    return isMissedCall(activity);
  }
  return false;
}

// Newest-first history: an outbound text closes the loop; a still-owed
// inbound text or missed call behind a later (non-reply) call still counts.
export function conversationOwedFromHistory<T extends Pick<Activity, "type" | "direction" | "needs_reply" | "metadata" | "reply_dismissed_at">>(
  activitiesNewestFirst: T[],
): { owed: boolean; activity: T | null } {
  for (const activity of activitiesNewestFirst) {
    if (activity.type === "text" && activity.direction === "outbound") return { owed: false, activity: null };
    if (isConversationOwed(activity)) return { owed: true, activity };
  }
  return { owed: false, activity: null };
}

export function inboxOwedCount(conversations: { owed: boolean }[]): number {
  return conversations.filter((c) => c.owed).length;
}
