import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailInbox } from "@/lib/google/sync-inbox";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();
  try {
    const result = await syncGmailInbox(admin, OWNER_ID);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Gmail sync cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "sync failed" }, { status: 500 });
  }
}
