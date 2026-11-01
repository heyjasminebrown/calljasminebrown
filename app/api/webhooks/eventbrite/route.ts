import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportFailure } from "@/lib/errors/report-failure";
import { fetchEventbrite, type EventbriteAttendee, type EventbriteOrder } from "@/lib/eventbrite/client";
import { recordEventbriteAttendee } from "@/lib/eventbrite/record-attendee";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export const maxDuration = 60;

// Eventbrite webhooks (Account Settings -> Developer Links -> Webhooks),
// one per connected Eventbrite account, all pointing here. Eventbrite
// doesn't sign deliveries, so the URL carries a secret, same as Blinq and
// Granola. Subscribed actions:
//   order.placed        -> each attendee on the order is "registered"
//   attendee.checked_in -> that attendee "attended" (Eventbrite check-in app)
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.EVENTBRITE_WEBHOOK_SECRET || secret !== process.env.EVENTBRITE_WEBHOOK_SECRET) {
    await reportFailure("Eventbrite webhook rejected: missing/incorrect secret in the webhook URL");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!OWNER_ID) {
    await reportFailure("Eventbrite webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: { config?: { action?: string }; api_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const action = body.config?.action ?? "unknown";
  const apiUrl = body.api_url;
  console.log("Eventbrite webhook received:", action, apiUrl);

  // Eventbrite sends a test ping when a webhook is created or tested.
  if (action === "test") return NextResponse.json({ received: true });
  if (!apiUrl) {
    await reportFailure(`Eventbrite ${action} webhook had no api_url to fetch`, JSON.stringify(body));
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  try {
    if (action === "order.placed") {
      const order = await fetchEventbrite<EventbriteOrder>(apiUrl, "attendees,event");
      const buyer = { first_name: order.first_name, last_name: order.last_name, email: order.email };
      for (const attendee of order.attendees ?? []) {
        if (attendee.cancelled || attendee.refunded) continue;
        await recordEventbriteAttendee(admin, OWNER_ID, { ...attendee, order_id: attendee.order_id ?? order.id }, order.event, "registered", buyer);
      }
    } else if (action === "attendee.checked_in" || action === "barcode.checked_in") {
      const attendee = await fetchEventbrite<EventbriteAttendee>(apiUrl, "event");
      await recordEventbriteAttendee(admin, OWNER_ID, attendee, attendee.event, "attended");
    } else {
      console.log("Unhandled Eventbrite webhook action:", action);
    }
  } catch (err) {
    await reportFailure(`Error processing Eventbrite ${action} webhook`, err, { apiUrl });
  }

  return NextResponse.json({ received: true });
}
