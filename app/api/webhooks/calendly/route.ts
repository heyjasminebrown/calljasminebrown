import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCalendlySignature } from "@/lib/calendly/verify-signature";
import { parseCalendlyInvitee } from "@/lib/calendly/parse-event";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { upsertActivity } from "@/lib/crm/activities";
import { notifyNewLead } from "@/lib/push/send-push";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const { ok, reason } = verifyCalendlySignature(rawBody, request.headers);
  if (reason) {
    console.warn("Calendly webhook signature not verified:", reason, {
      headers: Object.fromEntries(request.headers.entries()),
    });
  }
  if (!ok) {
    console.error("Calendly webhook rejected: signature check failed", reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!OWNER_ID) {
    console.error("Calendly webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventType = typeof body.event === "string" ? body.event : "unknown";
  const admin = createAdminClient();

  try {
    if (eventType === "invitee.created" || eventType === "invitee.canceled") {
      const invitee = parseCalendlyInvitee(body);
      const contact = await findOrCreateContact(admin, OWNER_ID, {
        email: invitee.email,
        phone: invitee.phone,
        firstName: invitee.firstName ?? invitee.name,
        lastName: invitee.lastName,
        leadSource: "Calendly",
      });

      if (contact) {
        const canceled = eventType === "invitee.canceled";

        if (contact.wasCreated && !canceled) {
          await notifyNewLead(admin, OWNER_ID, {
            title: "New lead via Calendly",
            body: `${invitee.firstName ?? invitee.name ?? invitee.email} booked ${invitee.eventName ?? "a meeting"}`,
            url: `/contacts/${contact.id}`,
          });
        }

        await upsertActivity(admin, OWNER_ID, contact.id, "calendly", "calendly_invitee_uri", invitee.inviteeUri, {
          type: "meeting",
          direction: "none",
          occurred_at: invitee.createdAt,
          body: describeBooking(invitee, canceled),
          metadata: {
            calendly_invitee_uri: invitee.inviteeUri,
            calendly_event_type: eventType,
            event_name: invitee.eventName,
            event_start_time: invitee.eventStartTime,
            questions_and_answers: invitee.questionsAndAnswers,
            raw: body,
          },
        });

        if (!canceled && invitee.eventStartTime) {
          await maybeUpdateNextFollowUp(admin, contact.id, invitee.eventStartTime);
        }
      }
    } else {
      console.log("Unhandled Calendly webhook event type:", eventType);
    }
  } catch (err) {
    console.error("Error processing Calendly webhook", eventType, err);
  }

  return NextResponse.json({ received: true });
}

function describeBooking(invitee: ReturnType<typeof parseCalendlyInvitee>, canceled: boolean) {
  const when = invitee.eventStartTime ? new Date(invitee.eventStartTime).toLocaleString() : null;
  const parts = [canceled ? "Canceled" : "Booked", invitee.eventName ?? "a meeting"];
  if (when) parts.push(`for ${when}`);
  const qa = invitee.questionsAndAnswers.map((item) => `${item.question}: ${item.answer}`).join(" · ");
  return [parts.join(" "), qa].filter(Boolean).join(" — ");
}

// Only pulls the follow-up date earlier, never pushes it later - a booked
// meeting is a concrete next touchpoint, but shouldn't bump a more urgent
// manually-set follow-up further out.
async function maybeUpdateNextFollowUp(admin: ReturnType<typeof createAdminClient>, contactId: string, eventStartTime: string) {
  const { data: contact } = await admin.from("contacts").select("next_follow_up_at").eq("id", contactId).maybeSingle();
  const current = contact?.next_follow_up_at ? new Date(contact.next_follow_up_at) : null;
  const meetingTime = new Date(eventStartTime);

  if (!current || meetingTime < current) {
    await admin.from("contacts").update({ next_follow_up_at: eventStartTime }).eq("id", contactId);
  }
}
