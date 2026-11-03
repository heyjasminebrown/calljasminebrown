"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots, type Slot } from "@/lib/crm/booking-availability";
import { availabilityFor } from "@/lib/crm/booking-calendars";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { reportFailure } from "@/lib/errors/report-failure";
import { finalizeBooking, loadCalendarById, resolveCalendar, toPublicCalendar, type PublicCalendar } from "@/lib/crm/book-meeting";
import type { BookingCalendar } from "@/types/database";

export type { PublicCalendar };

// Public, unauthenticated by design - shared by /book (her default
// calendar, or ?calendar=<link>) and /book/[slug] (a contact-prefilled
// link). Every action goes through the admin client scoped to the single
// owner account, not a user session.
//
// Booking is instant: the last step creates the Google Calendar event
// (a phone call, with an emailed invite), texts a confirmation, logs
// the meeting on the contact and notifies her. If Google refuses, the
// request is kept as pending for her to approve on Schedule instead of
// being lost, and the failure is reported.
const OWNER_ID = process.env.CRM_OWNER_USER_ID;
const SLUG_FORMAT = /^[A-Za-z0-9_-]{8}$/;
const CALENDAR_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ACTIVE_STAGES = new Set(["info", "time_selected", "pending"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Admin = ReturnType<typeof createAdminClient>;

export type BookingFlowData = {
  calendar: PublicCalendar;
  // Set when the page was opened without a specific calendar and she has
  // more than one active: the visitor picks one first.
  choices: PublicCalendar[] | null;
  durationMinutes: number;
  prefill: { name: string; phone: string; email: string } | null;
  slots: Slot[];
};

export async function getBookingFlowData(slug: string | null, calendarSlug: string | null = null): Promise<BookingFlowData | null> {
  if (!OWNER_ID) return null;
  if (slug && !SLUG_FORMAT.test(slug)) return null;
  if (calendarSlug && !CALENDAR_SLUG.test(calendarSlug)) return null;

  const admin = createAdminClient();

  let prefill: BookingFlowData["prefill"] = null;
  if (slug) {
    const { data: link } = await admin.from("booking_links").select("contact_id").eq("owner_id", OWNER_ID).eq("slug", slug).maybeSingle();
    if (!link) return null;
    const { data: contact } = await admin.from("contacts").select("first_name, last_name, phone, email").eq("id", link.contact_id).maybeSingle();
    if (contact) {
      prefill = { name: `${contact.first_name} ${contact.last_name ?? ""}`.trim(), phone: contact.phone ?? "", email: contact.email ?? "" };
    }
  }

  try {
    const { calendar, all } = await resolveCalendar(admin, OWNER_ID, calendarSlug);
    if (!calendar) return null;
    const slots = await computeAvailableSlots(admin, OWNER_ID, availabilityFor(calendar));
    return {
      calendar: toPublicCalendar(calendar),
      choices: !calendarSlug && !slug && all.length > 1 ? all.map(toPublicCalendar) : null,
      durationMinutes: calendar.duration_minutes,
      prefill,
      slots,
    };
  } catch (err) {
    await reportFailure("Booking page couldn't load available times", err);
    return null;
  }
}

// Step 1: name/phone/email. Creates the booking_requests row right away
// (stage 'info') and finds or creates the contact - so someone who stops
// partway still shows on Schedule under "Started but didn't book".
export async function startBookingSession(input: {
  slug: string | null;
  calendarSlug: string;
  name: string;
  phone: string;
  email: string;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "This page isn't set up yet." };
  if (input.slug && !SLUG_FORMAT.test(input.slug)) return { ok: false, error: "This link isn't valid." };
  if (!input.name.trim() || !input.phone.trim() || !input.email.trim()) return { ok: false, error: "Name, phone and email are required." };
  if (!EMAIL.test(input.email.trim())) return { ok: false, error: "That email doesn't look right - check it and try again." };

  const admin = createAdminClient();

  let linkId: string | null = null;
  if (input.slug) {
    const { data: link } = await admin.from("booking_links").select("id").eq("owner_id", OWNER_ID).eq("slug", input.slug).maybeSingle();
    if (!link) return { ok: false, error: "This link isn't valid." };
    linkId = link.id;
  }

  let calendar: BookingCalendar | null;
  try {
    calendar = (await resolveCalendar(admin, OWNER_ID, input.calendarSlug)).calendar;
  } catch (err) {
    await reportFailure("Booking page couldn't load the calendar", err);
    return { ok: false, error: "Something went wrong on our end - please try again in a minute." };
  }
  if (!calendar) return { ok: false, error: "This calendar isn't taking bookings right now." };

  const nameParts = input.name.trim().split(/\s+/);
  const contact = await findOrCreateContact(admin, OWNER_ID, {
    email: input.email.trim(),
    phone: input.phone.trim(),
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || null,
    leadSource: "Website",
  });
  if (!contact) await reportFailure("Booking page couldn't find or create a contact", { name: input.name, phone: input.phone, email: input.email });

  const { data: created, error } = await admin
    .from("booking_requests")
    .insert({
      owner_id: OWNER_ID,
      booking_link_id: linkId,
      contact_id: contact?.id ?? null,
      visitor_name: input.name.trim(),
      visitor_phone: input.phone.trim(),
      visitor_email: input.email.trim(),
      calendar_id: calendar.id,
      calendar_name: calendar.name,
      stage: "info",
    })
    .select("id")
    .single();
  if (error || !created) {
    await reportFailure("Booking page couldn't start a booking", error?.message);
    return { ok: false, error: "Couldn't start that - try again." };
  }

  return { ok: true, sessionId: created.id as string };
}

async function sessionAndCalendar(admin: Admin, ownerId: string, sessionId: string) {
  const { data: session } = await admin.from("booking_requests").select("*").eq("id", sessionId).eq("owner_id", ownerId).maybeSingle();
  if (!session) return { session: null, calendar: null };
  const calendar = await loadCalendarById(admin, ownerId, session.calendar_id ?? null);
  return { session, calendar };
}

// Step 2: pick a time. Re-validated against fresh availability rather than
// trusting the slot the browser last saw.
export async function selectBookingSlot(sessionId: string, startsAt: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "server not configured" };
  const admin = createAdminClient();

  const { session, calendar } = await sessionAndCalendar(admin, OWNER_ID, sessionId);
  if (!session || !ACTIVE_STAGES.has(session.stage)) return { ok: false, error: "This booking session isn't active anymore - refresh the page." };
  if (!calendar) return { ok: false, error: "This calendar isn't taking bookings right now." };

  const slots = await computeAvailableSlots(admin, OWNER_ID, availabilityFor(calendar), sessionId);
  const slot = slots.find((s) => s.startAt === startsAt);
  if (!slot) return { ok: false, error: "That time isn't available anymore - pick another." };

  const { error } = await admin
    .from("booking_requests")
    .update({ starts_at: slot.startAt, ends_at: slot.endAt, stage: "time_selected" })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "Couldn't save that - try again." };

  return { ok: true };
}

// Step 3: what they want to talk about, then book it.
export async function confirmBooking(
  sessionId: string,
  input: { topic: string },
): Promise<{ ok: true; confirmed: boolean } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "server not configured" };
  const admin = createAdminClient();

  const { session, calendar } = await sessionAndCalendar(admin, OWNER_ID, sessionId);
  if (!session || !session.starts_at || !session.ends_at) return { ok: false, error: "Pick a time first." };
  if (session.stage === "approved") return { ok: true, confirmed: true };
  if (!ACTIVE_STAGES.has(session.stage)) return { ok: false, error: "This booking session isn't active anymore - refresh the page." };
  if (!calendar) return { ok: false, error: "This calendar isn't taking bookings right now." };

  const result = await finalizeBooking(admin, OWNER_ID, session, calendar, input.topic);
  if (!result.ok && result.taken) return { ok: false, error: "Sorry - that time was just taken. Go back and pick another." };
  return result.ok ? { ok: true, confirmed: result.confirmed } : { ok: false, error: result.error };
}
