import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runTextAutomation } from "@/lib/crm/text-automation";
import { reportFailure } from "@/lib/errors/report-failure";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// Every minute: replies get Text 2 about a minute later, and sends are
// spread out a couple at a time (see lib/crm/text-automation.ts).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedCronRequest(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  try {
    const result = await runTextAutomation(createAdminClient(), OWNER_ID);
    if ("sent" in result && (result.sent ?? 0) > 0) console.log("Text automation:", JSON.stringify(result));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await reportFailure("Text automation run failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}
