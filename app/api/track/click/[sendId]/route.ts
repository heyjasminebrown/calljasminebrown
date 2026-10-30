import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { checkWarmNotifications } from "@/lib/crm/warm-notifications";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function GET(request: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const target = request.nextUrl.searchParams.get("url");
  const admin = createAdminClient();

  const isValidTarget = !!target && /^https?:\/\//.test(target);

  const { data: send } = await admin
    .from("email_sequence_sends")
    .select("contact_id, click_count, clicked_at")
    .eq("id", sendId)
    .maybeSingle();
  if (send) {
    await admin
      .from("email_sequence_sends")
      .update({ clicked_at: send.clicked_at ?? new Date().toISOString(), click_count: send.click_count + 1 })
      .eq("id", sendId);
    // Per-link detail (which of possibly several links in this email, not
    // just "clicked something") - a separate event log rather than
    // aggregated on the send row, since one send can click multiple links.
    if (isValidTarget) {
      await admin.from("email_link_clicks").insert({ send_id: sendId, url: target });
    }
    // A click is a strong, hard-to-fake engagement signal on its own - see
    // hasRecentEmailEngagement in lib/crm/engagement.ts.
    if (OWNER_ID) {
      await updateEngagementTag(admin, OWNER_ID, send.contact_id).catch(() => {});
      await checkWarmNotifications(admin, OWNER_ID, send.contact_id, sendId, "click").catch(() => {});
    }
  }

  // Only ever redirects to a link that was actually in the email body
  // (rewritten there at send time), never an arbitrary caller-supplied
  // destination beyond that - still worth the http(s) sanity check.
  if (isValidTarget) {
    return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL("/", request.url));
}
