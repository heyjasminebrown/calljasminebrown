"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeDismissal } from "@/lib/crm/dismissed-insights";
import { NEW_LEAD_DISMISS_KEY } from "@/lib/data/new-leads";

export async function clearPinnedItem(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("pinned_today_items").update({ cleared_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

// The specific bug the owner described: a double-fired Eventbrite webhook
// logs the same registration twice a few seconds apart, which inflates
// the dialer's registration count for that contact and makes a genuinely
// new registrant look like a returning one. Deleting the later of the two
// near-duplicate rows restores the correct count - the pair was already
// surfaced by buildWeeklyReview's <5-second-apart check, so this only
// ever touches a row a person has been shown and clicked "Fix to New" on.
export async function fixDoubleRegistration(secondActivityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("activities").delete().eq("id", secondActivityId).eq("owner_id", user.id).eq("source", "eventbrite");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

// "I don't actually need to text them back" - hides this specific message
// from Replies owed and stops the reply-reminder cron from ever nudging
// about it. Keyed to the activity row, not the contact, so a new inbound
// text from the same person later is unaffected.
export async function dismissReplyOwed(activityId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("activities").update({ reply_dismissed_at: new Date().toISOString() }).eq("id", activityId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/messages");
  return { ok: true as const };
}

// The mobile Up-next card's Snooze button, for a call/task-shaped item
// (a replies-owed item uses dismissReplyOwed instead, which already
// exists and does the right thing for that case). Pushes the follow-up
// a day out rather than clearing it - "not now" not "never."
export async function snoozeFollowUp(contactId: string, days = 1) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const next = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("contacts").update({ next_follow_up_at: next }).eq("id", contactId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/messages/${contactId}`);
  return { ok: true as const };
}

export async function snoozeTask(taskId: string, days: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const next = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("tasks").update({ due_at: next }).eq("id", taskId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/contacts");
  return { ok: true as const };
}

// Genuinely clears the follow-up (vs. snoozeFollowUp's "push it a day") -
// for Today's Calls worklist, which had no dismiss at all: a contact with
// next_follow_up_at set kept showing up every single day with no way to
// say "I don't need to call this person" short of opening their record
// and clearing the date by hand.
export async function clearFollowUp(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("contacts").update({ next_follow_up_at: null }).eq("id", contactId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/messages/${contactId}`);
  return { ok: true as const };
}

// "No action needed for this registration" - Today's "Registered, no
// follow-up" group used to have no dismiss at all (only Calls/Replies
// owed did), so a vendor or plus-one who isn't a real lead reappeared
// every single day with no escape hatch. Reuses the same dismissed_insights
// table Insights/Sphere already write to (see lib/crm/contact-queue-filter.ts's
// filter, which only honors the dismissal while it's newer than the
// registration that triggered it).
export async function dismissRegisteredNoFollowUp(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const result = await writeDismissal(supabase, user.id, "registered_no_followup", contactId);
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true as const };
}

// "Doesn't need a follow-up" / "remove from New Leads altogether" - the
// product owner confirmed these are the same single permanent action, not
// two states. No time-window check on read (unlike
// dismissRegisteredNoFollowUp's "only while newer than the triggering
// registration") - this is a true forever-dismiss.
export async function dismissNewLead(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const result = await writeDismissal(supabase, user.id, NEW_LEAD_DISMISS_KEY, contactId);
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true as const };
}

// "Leave it" / "Compare later" on the weekly review's double-registration
// and duplicate-phone rows - unlike Fix/Merge, nothing about the
// underlying data changes, so without a persisted dismissal the row came
// right back on the next load (see filterResolvedWeeklyReviewItems, which
// reads this same table). contactId is the second/duplicate contact in
// the pair (d.contactId for a double-registration, p.bId for a phone
// duplicate) so the key matches what that filter checks.
export async function dismissWeeklyReviewItem(key: "weekly_review_double" | "weekly_review_dup", contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const result = await writeDismissal(supabase, user.id, key, contactId);
  if (!result.ok) return result;
  revalidatePath("/");
  return { ok: true as const };
}

export async function markKnownPersonally(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("contacts").update({ known_personally: true }).eq("id", contactId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  return { ok: true as const };
}

// Settings -> People you know's Remove button - the review/undo half of
// "Never queue this person," so a permanent dismissal is reversible
// without having to find the contact's own profile.
export async function unmarkKnownPersonally(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.from("contacts").update({ known_personally: false }).eq("id", contactId).eq("owner_id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true as const };
}
