import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runAutoStage } from "@/lib/crm/auto-stage";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();

  try {
    const { moved } = await runAutoStage(admin, OWNER_ID);
    return NextResponse.json({ ok: true, moved });
  } catch (err) {
    console.error("Auto-stage cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "auto-stage failed" }, { status: 500 });
  }
}
