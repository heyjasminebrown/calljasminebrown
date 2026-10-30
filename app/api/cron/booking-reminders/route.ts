import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendAbandonedBookingFollowUps } from "@/lib/crm/booking-abandonment";
import { sendBookingRequestReminders } from "@/lib/crm/booking-reminders";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// Unlike the reply-reminders cron, this doesn't gate on quiet hours - a
// meeting request sitting unanswered is high priority regardless of the
// hour, per her explicit ask.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();

  try {
    const sent = await sendBookingRequestReminders(admin, OWNER_ID);
    const abandoned = await sendAbandonedBookingFollowUps(admin, OWNER_ID);
    return NextResponse.json({ ok: true, sent, abandoned });
  } catch (err) {
    console.error("Booking-reminders cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "booking reminders failed" }, { status: 500 });
  }
}
