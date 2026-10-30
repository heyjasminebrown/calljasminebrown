import type { SupabaseClient } from "@supabase/supabase-js";

// Whenever a meeting is scheduled through the CRM, meeting-actions.ts
// stores the Google Calendar event id as an activity's dedupe key
// (source: "manual", dedupe_field: "google_event_id" - see
// scheduleMeeting). That's the most reliable match available for a
// transcript source that also knows the calendar event id (a Granola
// video meeting carries one) - no live Calendar API call needed, just a
// lookup against what the CRM already wrote when the meeting was created.
export async function matchByCalendarEventId(admin: SupabaseClient, ownerId: string, calendarEventId: string): Promise<string | null> {
  const { data } = await admin
    .from("activities")
    .select("contact_id")
    .eq("owner_id", ownerId)
    .eq("source", "manual")
    .eq("dedupe_field", "google_event_id")
    .eq("dedupe_value", calendarEventId)
    .maybeSingle();

  return data?.contact_id ?? null;
}

// Fallback for a meeting/note with no CRM-stored calendar event (not
// scheduled through the CRM at all, or an in-person Granola note with no
// invite to begin with) - exact match against a participant's email.
export async function matchByAttendeeEmail(admin: SupabaseClient, ownerId: string, emails: string[]): Promise<string | null> {
  const cleaned = emails.filter(Boolean).map((e) => e.trim().toLowerCase());
  if (cleaned.length === 0) return null;

  const { data } = await admin
    .from("contacts")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .in("email", cleaned)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
