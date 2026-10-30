import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { checkWarmNotifications } from "@/lib/crm/warm-notifications";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// 1x1 transparent GIF, served regardless of whether the send row exists so
// a broken/expired tracking pixel never shows as a visible broken image.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params;
  const admin = createAdminClient();

  const { data: send } = await admin
    .from("email_sequence_sends")
    .select("contact_id, open_count, opened_at")
    .eq("id", sendId)
    .maybeSingle();
  if (send) {
    await admin
      .from("email_sequence_sends")
      .update({ opened_at: send.opened_at ?? new Date().toISOString(), open_count: send.open_count + 1 })
      .eq("id", sendId);
    // A repeat open (open_count going to 2+) is what actually counts as an
    // engagement signal - see hasRecentEmailEngagement - so this only
    // matters starting the second time, but it's cheap enough to just
    // always recompute rather than special-case the first open away.
    if (OWNER_ID) {
      await updateEngagementTag(admin, OWNER_ID, send.contact_id).catch(() => {});
      await checkWarmNotifications(admin, OWNER_ID, send.contact_id, sendId, "open").catch(() => {});
    }
  }

  return new NextResponse(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
