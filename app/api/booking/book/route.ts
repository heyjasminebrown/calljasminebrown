import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/crm/booking-availability";
import { availabilityFor } from "@/lib/crm/booking-calendars";
import { finalizeBooking, resolveCalendar, toPublicCalendar } from "@/lib/crm/book-meeting";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { reportFailure } from "@/lib/errors/report-failure";
import { CALENDAR_SLUG, json, preflight } from "@/lib/crm/booking-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  calendar?: string;
  startsAt?: string;
  name?: string;
  phone?: string;
  email?: string;
  topic?: string;
  // Source for a NEW contact (e.g. "Website", "Get a Quote"). Existing
  // contacts keep theirs.
  source?: string;
  // Honeypot: real visitors never fill this in.
  website?: string;
};

// POST /api/booking/book  (JSON body above)
// Books the time for real: finds or creates the contact, re-checks the
// slot, creates the Google event (a phone call; invite to them and to her
// Outlook), logs it, texts a confirmation and notifies her.
//   200 { ok: true, confirmed: true, startsAt, endsAt, calendar }
//   200 { ok: true, confirmed: false, ... }  Google refused; waits for her approval
//   400 bad input · 404 unknown calendar · 409 time no longer open
export async function POST(request: NextRequest) {
  const ownerId = process.env.CRM_OWNER_USER_ID;
  if (!ownerId) return json(request, { ok: false, error: "Booking isn't set up yet." }, 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(request, { ok: false, error: "Send JSON." }, 400);
  }

  const name = body.name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const topic = body.topic?.trim().slice(0, 2000) || null;
  const source = body.source?.trim().slice(0, 60) || "Website";
  const slug = body.calendar?.trim().toLowerCase() || null;

  if (body.website) return json(request, { ok: true, confirmed: true }); // bot
  if (!name || !phone || !email) return json(request, { ok: false, error: "Name, phone and email are required." }, 400);
  if (name.length > 120 || phone.length > 40 || email.length > 200) return json(request, { ok: false, error: "That's too long." }, 400);
  if (!EMAIL.test(email)) return json(request, { ok: false, error: "That email doesn't look right - check it and try again." }, 400);
  if (slug && !CALENDAR_SLUG.test(slug)) return json(request, { ok: false, error: "Unknown calendar." }, 404);
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return json(request, { ok: false, error: "Pick a time." }, 400);

  try {
    const admin = createAdminClient();
    const { calendar } = await resolveCalendar(admin, ownerId, slug);
    if (!calendar) return json(request, { ok: false, error: "This calendar isn't taking bookings right now." }, 404);

    const slots = await computeAvailableSlots(admin, ownerId, availabilityFor(calendar));
    const slot = slots.find((s) => s.startAt === startsAt.toISOString());
    if (!slot) return json(request, { ok: false, error: "That time isn't available anymore - pick another.", taken: true }, 409);

    const parts = name.split(/\s+/);
    const contact = await findOrCreateContact(admin, ownerId, {
      email,
      phone,
      firstName: parts[0],
      lastName: parts.slice(1).join(" ") || null,
      leadSource: source,
    });
    if (!contact) await reportFailure("Booking API couldn't find or create a contact", { name, phone, email });

    const { data: session, error } = await admin
      .from("booking_requests")
      .insert({
        owner_id: ownerId,
        contact_id: contact?.id ?? null,
        visitor_name: name,
        visitor_phone: phone,
        visitor_email: email,
        calendar_id: calendar.id,
        calendar_name: calendar.name,
        starts_at: slot.startAt,
        ends_at: slot.endAt,
        stage: "time_selected",
      })
      .select("id, contact_id, visitor_name, visitor_phone, visitor_email, starts_at, ends_at, stage")
      .single();
    if (error || !session) {
      await reportFailure("Booking API couldn't save a booking", error?.message);
      return json(request, { ok: false, error: "Couldn't book that - try again." }, 500);
    }

    const result = await finalizeBooking(admin, ownerId, session, calendar, topic);
    if (!result.ok) return json(request, { ok: false, error: result.error, taken: !!result.taken }, result.taken ? 409 : 500);
    return json(request, {
      ok: true,
      confirmed: result.confirmed,
      startsAt: slot.startAt,
      endsAt: slot.endAt,
      calendar: toPublicCalendar(calendar),
    });
  } catch (err) {
    await reportFailure("Booking API failed", err);
    return json(request, { ok: false, error: "Something went wrong on our end - please try again in a minute." }, 500);
  }
}

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}
