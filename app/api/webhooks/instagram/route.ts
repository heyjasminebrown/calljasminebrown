import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyInstagramSignature } from "@/lib/instagram/verify-signature";
import { parseInstagramEvents } from "@/lib/instagram/parse-event";
import { fetchInstagramProfile } from "@/lib/instagram/graph-client";
import { createOrGetInstagramMessage, getRememberedMatch, mirrorInstagramMessageToActivity } from "@/lib/data/instagram-messages";
import { updateEngagementTag } from "@/lib/crm/engagement";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

// Meta's one-time handshake when the webhook subscription is first
// registered in the App Dashboard - echoes hub.challenge back only if
// hub.verify_token matches what's configured there.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && challenge && token && process.env.META_VERIFY_TOKEN && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const { ok, reason } = verifyInstagramSignature(rawBody, request.headers);
  if (!ok) {
    console.error("Instagram webhook rejected:", reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!OWNER_ID) {
    console.error("Instagram webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;

  try {
    const events = parseInstagramEvents(body);
    if (events.length === 0) console.log("Instagram webhook with no recognizable messaging events", body);

    for (const event of events) {
      // A message SHE sent (via the Send API, or from the Instagram app
      // itself) is delivered back through this same webhook as an echo -
      // skip it, it's already logged at send time (or doesn't need to be,
      // for a manual reply from the Instagram app itself).
      if (event.isEcho) continue;

      const { id: messageRowId, wasCreated } = await createOrGetInstagramMessage(admin, {
        ownerId: OWNER_ID,
        contactId: null,
        igSenderId: event.senderId,
        igMessageId: event.messageId,
        text: event.text,
        occurredAt: event.occurredAt,
        raw: body,
      });
      if (!wasCreated) continue;

      const contactId = await getRememberedMatch(admin, OWNER_ID, event.senderId);
      if (contactId) {
        await mirrorInstagramMessageToActivity(admin, OWNER_ID, contactId, messageRowId, event.messageId, event.text, event.occurredAt);
        await updateEngagementTag(admin, OWNER_ID, contactId);
      } else if (pageAccessToken) {
        // Best-effort - a stranger's handle/name so the Messages inbox can
        // show "@atl_renovator" instead of a bare sender id.
        const profile = await fetchInstagramProfile(event.senderId, pageAccessToken);
        if (profile.username || profile.name) {
          await admin.from("instagram_messages").update({ ig_username: profile.username, ig_name: profile.name }).eq("id", messageRowId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing Instagram webhook", err);
    return NextResponse.json({ received: true });
  }
}
