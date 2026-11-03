import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAvailableSlots } from "@/lib/crm/booking-availability";
import { availabilityFor, DEFAULT_WEEKLY_HOURS } from "@/lib/crm/booking-calendars";
import { upsertActivity } from "@/lib/crm/activities";
import { createMeetingInvite } from "@/lib/google/calendar";
import { sendQuoText } from "@/lib/quo/send-message";
import { buildBookingConfirmedMessage } from "@/lib/crm/booking-message";
import { notifyNewLead } from "@/lib/push/send-push";
import { reportFailure } from "@/lib/errors/report-failure";
import { OWNER_FIRST_NAME } from "@/lib/brand/identity";
import type { BookingCalendar } from "@/types/database";

// Shared by the CRM's own /book page and the booking API that
// heyjasminebrown.com/meet calls: which calendars are open, and turning a
// chosen time into a real meeting (Google event + Meet + invites, contact
// timeline, confirmation text, notification). Meetings are phone calls.

export type PublicCalendar = { slug: string; name: string; description: string | null; durationMinutes: number };

export function toPublicCalendar(c: BookingCalendar): PublicCalendar {
  return { slug: c.slug, name: c.name, description: c.description, durationMinutes: c.duration_minutes };
}

export async function activeCalendars(admin: SupabaseClient, ownerId: string): Promise<BookingCalendar[]> {
  const { data, error } = await admin.from("booking_calendars").select("*").eq("owner_id", ownerId).order("sort_order").order("created_at");
  if (error) throw new Error(`Couldn't load booking calendars: ${error.message}`);
  let rows = (data ?? []) as BookingCalendar[];
  if (rows.length === 0) {
    // Never left with no calendar at all: recreate the starting one.
    const { data: created, error: createError } = await admin
      .from("booking_calendars")
      .insert({ owner_id: ownerId, name: "Intro call", slug: "intro-call", duration_minutes: 20, weekly_hours: DEFAULT_WEEKLY_HOURS, is_default: true })
      .select("*");
    if (createError) throw new Error(`Couldn't create the default booking calendar: ${createError.message}`);
    rows = (created ?? []) as BookingCalendar[];
  }
  return rows.filter((c) => c.active);
}

// calendarSlug null = her main calendar.
export async function resolveCalendar(
  admin: SupabaseClient,
  ownerId: string,
  calendarSlug: string | null,
): Promise<{ calendar: BookingCalendar | null; all: BookingCalendar[] }> {
  const all = await activeCalendars(admin, ownerId);
  if (calendarSlug) return { calendar: all.find((c) => c.slug === calendarSlug) ?? null, all };
  return { calendar: all.find((c) => c.is_default) ?? all[0] ?? null, all };
}

export async function loadCalendarById(admin: SupabaseClient, ownerId: string, id: string | null): Promise<BookingCalendar | null> {
  if (!id) return (await resolveCalendar(admin, ownerId, null)).calendar;
  const { data } = await admin.from("booking_calendars").select("*").eq("owner_id", ownerId).eq("id", id).maybeSingle();
  return (data as BookingCalendar | null) ?? null;
}

export type BookingSession = {
  id: string;
  contact_id: string | null;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  starts_at: string | null;
  ends_at: string | null;
  stage: string;
};

export type FinalizeResult = { ok: true; confirmed: boolean } | { ok: false; error: string; taken?: boolean };

// The booking_requests row already has its time. Re-check the slot, then
// book it. If Google refuses, the request is kept as pending for her to
// approve on Schedule (never lost) and the failure is reported.
export async function finalizeBooking(
  admin: SupabaseClient,
  ownerId: string,
  session: BookingSession,
  calendar: BookingCalendar,
  topicInput: string | null,
): Promise<FinalizeResult> {
  if (!session.starts_at || !session.ends_at) return { ok: false, error: "Pick a time first." };

  const slots = await computeAvailableSlots(admin, ownerId, availabilityFor(calendar), session.id);
  if (!slots.some((s) => s.startAt === new Date(session.starts_at!).toISOString())) {
    await admin.from("booking_requests").update({ stage: "info", starts_at: null, ends_at: null }).eq("id", session.id);
    return { ok: false, error: "Sorry - that time was just taken. Pick another.", taken: true };
  }

  const topic = topicInput?.trim() || null;
  const durationMinutes = Math.max(5, Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60_000));
  const description = [
    `Phone call: ${OWNER_FIRST_NAME} will call ${session.visitor_name} at ${session.visitor_phone}.`,
    topic ? `Topic: ${topic}` : null,
    `Booked online (${calendar.name})`,
  ]
    .filter(Boolean)
    .join("\n");

  const invite = await createMeetingInvite(admin, ownerId, {
    attendeeEmail: session.visitor_email,
    attendeeName: session.visitor_name,
    title: `${calendar.name}: ${session.visitor_name} & ${OWNER_FIRST_NAME}`,
    description,
    startAt: session.starts_at,
    durationMinutes,
    location: `Phone call: ${session.visitor_phone}`,
  });

  const now = new Date().toISOString();
  const when = new Date(session.starts_at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (!invite.ok) {
    await admin.from("booking_requests").update({ questions: topic, stage: "pending", submitted_at: now }).eq("id", session.id);
    await reportFailure(`A booking couldn't be added to your Google Calendar - approve it on Schedule (${session.visitor_name}, ${when})`, invite.error);
    await notifyNewLead(admin, ownerId, { title: session.visitor_name, body: `Requested ${when} - couldn't auto-book, approve it`, url: "/scheduling" });
    return { ok: true, confirmed: false };
  }

  const { error: updateError } = await admin
    .from("booking_requests")
    .update({ questions: topic, stage: "approved", submitted_at: now, decided_at: now, google_event_id: invite.eventId })
    .eq("id", session.id);
  if (updateError) await reportFailure("A booking was added to Google Calendar but not saved in the CRM", updateError.message, { sessionId: session.id });

  if (session.contact_id) {
    await upsertActivity(admin, ownerId, session.contact_id, "scheduling", "booking_request_id", session.id, {
      type: "meeting",
      direction: "none",
      occurred_at: session.starts_at,
      body: `${calendar.name} (${durationMinutes} min) booked online${topic ? ` · Topic: ${topic}` : ""}`,
      metadata: {
        google_event_id: invite.eventId,
        html_link: invite.htmlLink,
        booking_request_id: session.id,
        calendar_id: calendar.id,
        duration_minutes: durationMinutes,
      },
    });
    await textConfirmation(admin, ownerId, session.contact_id, session.visitor_phone, session.visitor_name, session.starts_at);
  }

  await notifyNewLead(admin, ownerId, {
    title: session.visitor_name,
    body: `Booked ${calendar.name} for ${when}`,
    url: session.contact_id ? `/contacts/${session.contact_id}` : "/scheduling",
  });

  return { ok: true, confirmed: true };
}

async function textConfirmation(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  phone: string,
  visitorName: string,
  startsAt: string,
) {
  const { data: contact } = await admin.from("contacts").select("opted_out_at").eq("id", contactId).maybeSingle();
  if (contact?.opted_out_at) return;
  const body = buildBookingConfirmedMessage({ visitorFirstName: visitorName.split(" ")[0] || visitorName, startsAt, phone });
  const result = await sendQuoText(phone, body);
  if (!result.ok) {
    await reportFailure(`Booking confirmation text to ${visitorName} failed`, result.error, { contactId });
    return;
  }
  await upsertActivity(admin, ownerId, contactId, "quo", "quo_message_id", result.quoMessageId, {
    type: "text",
    direction: "outbound",
    occurred_at: new Date().toISOString(),
    body,
    metadata: { quo_message_id: result.quoMessageId, sent_from_crm: true, booking_confirmation: true },
  });
}
