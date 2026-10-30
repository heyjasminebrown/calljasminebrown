import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { buildWeeklyReview } from "@/lib/data/weekly-review";
import { sendGmailMessage } from "@/lib/google/send-email";
import { renderWeeklyReviewEmail } from "@/lib/crm/weekly-review-email";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();

  try {
    const payload = await buildWeeklyReview(admin, OWNER_ID);

    await admin.from("pinned_today_items").insert({ owner_id: OWNER_ID, kind: "weekly_review", payload });

    const { data: account } = await admin.from("gmail_accounts").select("email_address").eq("owner_id", OWNER_ID).maybeSingle();
    if (account) {
      await sendGmailMessage(admin, OWNER_ID, account.email_address, "Your weekly review", renderWeeklyReviewEmail(payload));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Weekly-review cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "weekly review failed" }, { status: 500 });
  }
}
