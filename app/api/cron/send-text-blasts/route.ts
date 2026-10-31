import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingTextBlasts } from "@/lib/crm/text-blasts";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { reportFailure } from "@/lib/errors/report-failure";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// A full batch has real jittered spacing between each send (see
// lib/crm/text-blasts.ts) to avoid looking like a bulk-send burst - the
// default serverless timeout isn't long enough to cover that.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedCronRequest(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();
  try {
    await processPendingTextBlasts(admin, OWNER_ID);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportFailure("Send-text-blasts cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "send failed" }, { status: 500 });
  }
}
