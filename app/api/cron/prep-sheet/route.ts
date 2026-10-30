import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { buildPrepSheet } from "@/lib/data/prep-sheet";
import { renderPrepSheetEmail } from "@/lib/crm/prep-sheet-email";
import { sendGmailMessage } from "@/lib/google/send-email";
import { notifyNewLead } from "@/lib/push/send-push";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;
const WINDOW_MIN_MS = 25 * 60 * 1000;
const WINDOW_MAX_MS = 35 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!OWNER_ID) return NextResponse.json({ error: "CRM_OWNER_USER_ID not configured" }, { status: 500 });

  const admin = createAdminClient();
  const now = Date.now();
  const timeMin = new Date(now + WINDOW_MIN_MS).toISOString();
  const timeMax = new Date(now + WINDOW_MAX_MS).toISOString();

  try {
    const events = await listUpcomingEvents(admin, OWNER_ID, timeMin, timeMax);
    let sent = 0;

    for (const event of events) {
      if (event.attendeeEmails.length === 0) continue;

      // Claim first (primary key on event_id) so a meeting sitting inside
      // the 10-minute window across two 5-minute polls only ever fires
      // once - the second poll's insert conflicts and this loop just
      // moves on.
      const { error: claimError } = await admin.from("prep_sheet_sends").insert({ event_id: event.id, owner_id: OWNER_ID });
      if (claimError) continue;

      const { data: contact } = await admin
        .from("contacts")
        .select("id")
        .eq("owner_id", OWNER_ID)
        .eq("archived", false)
        .in("email", event.attendeeEmails)
        .limit(1)
        .maybeSingle();
      if (!contact) continue;

      const payload = await buildPrepSheet(admin, OWNER_ID, event, contact.id);
      if (!payload) continue;

      await admin.from("pinned_today_items").insert({ owner_id: OWNER_ID, kind: "prep_sheet", payload });

      const { data: account } = await admin.from("gmail_accounts").select("email_address").eq("owner_id", OWNER_ID).maybeSingle();
      if (account) {
        await sendGmailMessage(admin, OWNER_ID, account.email_address, `In 30 min: ${event.title}`, renderPrepSheetEmail(payload));
      }
      await notifyNewLead(admin, OWNER_ID, {
        title: `${payload.contactName} in 30 minutes`,
        body: event.title,
        url: "/",
      });
      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("Prep-sheet cron failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "prep sheet failed" }, { status: 500 });
  }
}
