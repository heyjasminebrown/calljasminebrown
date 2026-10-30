import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isWithinQuietHours } from "@/lib/crm/warm-notifications";
import { sendReplyReminders } from "@/lib/crm/reply-reminders";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });
  if (!isWithinQuietHours()) return NextResponse.json({ ok: true, skipped: "outside quiet hours" });

  const admin = createAdminClient();

  try {
    const sent = await sendReplyReminders(admin, OWNER_ID);
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("Reply-reminders cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "reply reminders failed" }, { status: 500 });
  }
}
