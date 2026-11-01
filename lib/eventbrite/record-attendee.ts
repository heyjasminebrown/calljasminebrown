import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { addTagByName } from "@/lib/crm/add-tag";
import { upsertActivity } from "@/lib/crm/activities";
import { reportFailure } from "@/lib/errors/report-failure";
import type { EventbriteAttendee, EventbriteEvent, EventbriteProfile } from "@/lib/eventbrite/client";

function clean(v: string | null | undefined): string | null {
  return v && v.trim() ? v.trim() : null;
}

// One Eventbrite attendee -> the matching contact (created as Community /
// Nurture with lead source "Event" if new), tagged with the event's name, with a timeline entry.
// "registered" logs source=eventbrite; "attended" logs source=checkin and
// sets last_event_name, which is what the Contacts Events filter reads.
// Both dedupe on the attendee id, so Eventbrite's retries are harmless.
export async function recordEventbriteAttendee(
  admin: SupabaseClient,
  ownerId: string,
  attendee: EventbriteAttendee,
  event: EventbriteEvent | null | undefined,
  kind: "registered" | "attended",
  fallbackProfile?: EventbriteProfile,
): Promise<void> {
  const profile = attendee.profile ?? {};
  const email = clean(profile.email) ?? clean(fallbackProfile?.email);
  const phone = clean(profile.cell_phone);
  const firstName = clean(profile.first_name) ?? clean(fallbackProfile?.first_name);
  const lastName = clean(profile.last_name) ?? clean(fallbackProfile?.last_name);
  const eventName = clean(event?.name?.text) ?? "Eventbrite event";
  const eventStart = event?.start?.utc ?? null;

  if (!email && !phone) {
    await reportFailure(`Eventbrite ${kind} for "${eventName}" wasn't logged: the attendee has no email or phone`, {
      attendeeId: attendee.id,
    });
    return;
  }

  const contact = await findOrCreateContact(admin, ownerId, { email, phone, firstName, lastName, leadSource: "Event" });
  if (!contact) {
    await reportFailure(`Eventbrite ${kind} for "${eventName}" wasn't logged: couldn't match or create a contact`, {
      attendeeId: attendee.id,
      email,
    });
    return;
  }

  await addTagByName(admin, ownerId, contact.id, eventName);

  const metadata = {
    event_name: eventName,
    event_id: event?.id ?? null,
    event_start: eventStart,
    eventbrite_attendee_id: attendee.id,
    eventbrite_order_id: attendee.order_id ?? null,
  };

  if (kind === "registered") {
    await upsertActivity(admin, ownerId, contact.id, "eventbrite", "eventbrite_attendee_id", attendee.id, {
      type: "system",
      direction: "inbound",
      occurred_at: new Date().toISOString(),
      body: `Registered for ${eventName}`,
      metadata,
    });
    return;
  }

  const attendedAt = new Date().toISOString();
  await upsertActivity(admin, ownerId, contact.id, "checkin", "eventbrite_attendee_id", attendee.id, {
    type: "system",
    direction: "inbound",
    occurred_at: attendedAt,
    body: `Attended ${eventName}`,
    metadata,
  });
  const { error } = await admin
    .from("contacts")
    .update({ last_event_name: eventName, last_event_at: eventStart ?? attendedAt })
    .eq("id", contact.id);
  if (error) await reportFailure(`Eventbrite check-in for "${eventName}": couldn't update the contact's last event`, error.message);
}
