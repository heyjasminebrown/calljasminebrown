import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueSequences } from "@/lib/crm/sequences";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// A full batch of 8 sends now has a few seconds of real spacing between each
// (see lib/crm/sequences.ts) to avoid looking like a bulk-send burst to
// Gmail - the default serverless timeout isn't long enough to cover that on
// top of the actual send calls.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();
  try {
    await processDueSequences(admin, OWNER_ID);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Send-sequences cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "send failed" }, { status: 500 });
  }
}
