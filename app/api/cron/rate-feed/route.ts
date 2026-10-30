import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { fetchFredRate, recordDailyRate } from "@/lib/crm/rate-feed";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// Optional - FRED_API_KEY unset just means this cron no-ops every run,
// same as the calculator's rent-estimate API never being required. The
// manual entry in Settings (Numbers card) is the always-available path;
// this is a nicety on top of it, not a dependency the feature needs to
// work at all.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true, skipped: "FRED_API_KEY not configured" });

  const admin = createAdminClient();

  try {
    const observation = await fetchFredRate(apiKey);
    if (!observation) return NextResponse.json({ ok: true, skipped: "no observation returned" });

    await recordDailyRate(admin, OWNER_ID, observation.ratePct, "fred", observation.date);
    return NextResponse.json({ ok: true, ratePct: observation.ratePct, date: observation.date });
  } catch (err) {
    console.error("Rate-feed cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "rate feed failed" }, { status: 500 });
  }
}
