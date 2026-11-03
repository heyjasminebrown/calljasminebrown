import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/crm/booking-availability";
import { availabilityFor } from "@/lib/crm/booking-calendars";
import { resolveCalendar, toPublicCalendar } from "@/lib/crm/book-meeting";
import { reportFailure } from "@/lib/errors/report-failure";
import { CALENDAR_SLUG, json, preflight } from "@/lib/crm/booking-api";

export const dynamic = "force-dynamic";

// GET /api/booking/availability?calendar=<link>
// Open times for one booking calendar (her main one if no ?calendar),
// with Google + Outlook busy time, buffers and notice already applied.
export async function GET(request: NextRequest) {
  const ownerId = process.env.CRM_OWNER_USER_ID;
  if (!ownerId) return json(request, { ok: false, error: "Booking isn't set up yet." }, 503);

  const slug = request.nextUrl.searchParams.get("calendar")?.toLowerCase() || null;
  if (slug && !CALENDAR_SLUG.test(slug)) return json(request, { ok: false, error: "Unknown calendar." }, 404);

  try {
    const admin = createAdminClient();
    const { calendar, all } = await resolveCalendar(admin, ownerId, slug);
    if (!calendar) return json(request, { ok: false, error: "This calendar isn't taking bookings right now." }, 404);
    const slots = await computeAvailableSlots(admin, ownerId, availabilityFor(calendar));
    return json(request, {
      ok: true,
      timezone: "America/New_York",
      calendar: toPublicCalendar(calendar),
      calendars: all.map(toPublicCalendar),
      slots,
    });
  } catch (err) {
    await reportFailure("Booking API couldn't load open times", err);
    return json(request, { ok: false, error: "Couldn't load open times - try again in a minute." }, 500);
  }
}

export function OPTIONS(request: NextRequest) {
  return preflight(request);
}
