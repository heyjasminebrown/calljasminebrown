import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { notifyNewLead } from "@/lib/push/send-push";
import { APP_TIMEZONE } from "@/lib/format-time";

// A meeting request is high priority - someone is actively waiting to
// hear back. Long enough that she has a real window to review it during
// the day, short enough that it's still worth a nudge before it goes
// stale on her.
const REMINDER_DELAY_HOURS = 2;

export async function sendBookingRequestReminders(admin: SupabaseClient, ownerId: string): Promise<number> {
  const cutoff = new Date(Date.now() - REMINDER_DELAY_HOURS * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("booking_requests")
    .select("id, visitor_name, starts_at, submitted_at")
    .eq("owner_id", ownerId)
    .eq("stage", "pending")
    .is("reminder_sent_at", null)
    .not("submitted_at", "is", null)
    .lte("submitted_at", cutoff);

  let sent = 0;
  for (const row of data ?? []) {
    const when = row.starts_at ? formatInTimeZone(row.starts_at, APP_TIMEZONE, "EEE, MMM d 'at' h:mm a") : null;
    await notifyNewLead(admin, ownerId, {
      title: row.visitor_name,
      body: when ? `Still waiting on your approval for ${when}` : "Still waiting on your approval for a meeting request",
      url: "/scheduling",
    });
    await admin.from("booking_requests").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
    sent++;
  }

  return sent;
}
