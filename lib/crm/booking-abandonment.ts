import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyNewLead } from "@/lib/push/send-push";

// CRM /book flow writes booking_requests at stage `info` as soon as they
// leave name/phone (see startBookingSession). `time_selected` means they
// picked a slot but never submitted the prep form. Either is an
// incomplete CRM Booking-screen attempt — not Calendly.
export const ABANDONED_BOOKING_STAGES = ["info", "time_selected"] as const;
export const ABANDONMENT_DELAY_MS = 10 * 60 * 1000;

export function isAbandonedBookingStage(stage: string | null | undefined): boolean {
  return stage === "info" || stage === "time_selected";
}

export function isAbandonedFollowUpDue(createdAt: string, now = new Date()): boolean {
  const started = new Date(createdAt).getTime();
  if (!Number.isFinite(started)) return false;
  return now.getTime() - started >= ABANDONMENT_DELAY_MS;
}

export function shouldNotifyAbandonedBooking(
  row: { stage: string; created_at: string; abandonment_notified_at?: string | null },
  now = new Date(),
): boolean {
  if (!isAbandonedBookingStage(row.stage)) return false;
  if (row.abandonment_notified_at) return false;
  return isAbandonedFollowUpDue(row.created_at, now);
}

export function abandonedBookingNotifyCopy(row: {
  visitor_name?: string | null;
  starts_at?: string | null;
}): { title: string; body: string } {
  const title = (row.visitor_name || "Someone").trim() || "Someone";
  const body = row.starts_at
    ? "Started a booking, picked a time, and didn't finish — follow up"
    : "Started a booking and didn't finish — follow up";
  return { title, body };
}

export async function sendAbandonedBookingFollowUps(admin: SupabaseClient, ownerId: string): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONMENT_DELAY_MS).toISOString();

  const { data } = await admin
    .from("booking_requests")
    .select("id, visitor_name, starts_at, created_at, contact_id, stage, abandonment_notified_at")
    .eq("owner_id", ownerId)
    .in("stage", [...ABANDONED_BOOKING_STAGES])
    .is("abandonment_notified_at", null)
    .lte("created_at", cutoff);

  let sent = 0;
  for (const row of data ?? []) {
    if (!shouldNotifyAbandonedBooking(row)) continue;
    const copy = abandonedBookingNotifyCopy(row);
    await notifyNewLead(admin, ownerId, {
      title: copy.title,
      body: copy.body,
      url: row.contact_id ? `/contacts/${row.contact_id}` : "/scheduling",
    });
    await admin.from("booking_requests").update({ abandonment_notified_at: new Date().toISOString() }).eq("id", row.id);
    sent++;
  }

  return sent;
}
