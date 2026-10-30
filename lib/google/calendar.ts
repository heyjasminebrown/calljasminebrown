import { google } from "googleapis";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";

export type CreateMeetingInput = {
  // null when the only contact info on hand is a phone number (e.g. a
  // scheduling-page booking with no email given) - the event is still
  // created on her calendar, just with no attendee to email an invite to.
  attendeeEmail: string | null;
  attendeeName: string;
  title: string;
  description?: string;
  startAt: string; // ISO
  durationMinutes: number;
};

export type CreateMeetingResult =
  | { ok: true; eventId: string; meetLink: string | null; htmlLink: string | null }
  | { ok: false; error: string };

export type UpcomingCalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  attendeeEmails: string[];
};

// Read-only counterpart to createMeetingInvite above - nothing in this
// app has ever listed calendar events back, only created them. Used by
// the prep-sheet cron to find meetings starting soon; singleEvents
// expands recurring events into individual instances (otherwise a
// weekly-recurring meeting would show as one event with the series'
// original start time, not its next actual occurrence).
export async function listUpcomingEvents(admin: SupabaseClient, ownerId: string, timeMin: string, timeMax: string): Promise<UpcomingCalendarEvent[]> {
  const client = await getAuthorizedGoogleClient(admin, ownerId);
  if (!client) return [];

  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    return (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
      .map((e) => ({
        id: e.id ?? "",
        title: e.summary ?? "Untitled event",
        startAt: e.start!.dateTime!,
        endAt: e.end?.dateTime ?? e.start!.dateTime!,
        location: e.location ?? null,
        attendeeEmails: (e.attendees ?? []).map((a) => a.email).filter((email): email is string => !!email),
      }));
  } catch (err) {
    console.error("Google Calendar list failed", err);
    return [];
  }
}

// Google only attaches a Meet link to an event that explicitly requests
// conference data (conferenceDataVersion + a hangoutsMeet createRequest) -
// a plain calendar event has no video link at all. sendUpdates: "all" is
// what actually emails the invite to the attendee; without it the event is
// created silently and only she'd ever see it on her own calendar.
export async function createMeetingInvite(admin: SupabaseClient, ownerId: string, input: CreateMeetingInput): Promise<CreateMeetingResult> {
  const client = await getAuthorizedGoogleClient(admin, ownerId);
  if (!client) return { ok: false, error: "Google isn't connected. Connect it in Settings first." };

  const calendar = google.calendar({ version: "v3", auth: client });
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  try {
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: input.attendeeEmail ? "all" : "none",
      conferenceDataVersion: 1,
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail, displayName: input.attendeeName }] : undefined,
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetLink = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
    return { ok: true, eventId: data.id ?? "", meetLink, htmlLink: data.htmlLink ?? null };
  } catch (err) {
    console.error("Google Calendar event creation failed", err);
    const message = err instanceof Error ? err.message : "Failed to create the meeting";
    // The calendar scope was added after Gmail was already connected for
    // some accounts, so a stored token might still be missing it - Google
    // surfaces that as a 403/"insufficient authentication scopes" error,
    // which reads as a random failure unless it's translated. Reconnecting
    // (not retrying) is the actual fix.
    const insufficientScope = /insufficient|scope|403/i.test(message);
    return { ok: false, error: insufficientScope ? "Google needs to be reconnected in Settings to allow calendar invites." : message };
  }
}
