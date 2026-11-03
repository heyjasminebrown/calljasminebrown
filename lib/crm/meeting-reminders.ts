import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { sendQuoText } from "@/lib/quo/send-message";
import { upsertActivity } from "@/lib/crm/activities";
import { reportFailure } from "@/lib/errors/report-failure";

// Reminder texts for every CRM meeting (online bookings, approved
// requests, calls scheduled from a contact): 24 hours and 1 hour before.
// Meetings are phone calls - Jasmine calls them at their number.
//
// Skipped when: they booked very recently (the confirmation text just
// went out), it was cancelled in
// Google Calendar, or the contact opted out / is archived / spam / has no
// phone. Each reminder is claimed on the meeting before it's sent, so it
// goes out at most once.

const TZ = "America/New_York";
const HOUR = 60 * 60 * 1000;

type Kind = "24h" | "1h";
// quietAfterBooking: no reminder if they booked this recently (the
// confirmation text just went out).
const RULES: Record<Kind, { key: string; before: number; quietAfterBooking: number; notWithin: number }> = {
  // Sent once the call is <= 24h away (but still more than 2h away).
  "24h": { key: "reminder_24h_sent_at", before: 24 * HOUR, quietAfterBooking: 12 * HOUR, notWithin: 2 * HOUR },
  // Sent once the call is <= 1h away (but not in the last 10 minutes).
  "1h": { key: "reminder_1h_sent_at", before: 1 * HOUR, quietAfterBooking: 1 * HOUR, notWithin: 10 * 60 * 1000 },
};

export function reminderText(kind: Kind, firstName: string, startsAt: string): string {
  const time = formatInTimeZone(startsAt, TZ, "h:mm a");
  const first = firstName.trim() || "there";
  if (kind === "1h") return `Hi! I'll call you at ${time} ET. Talk soon!`;
  const tomorrow = formatInTimeZone(new Date(Date.now() + 24 * HOUR), TZ, "yyyy-MM-dd");
  const day = formatInTimeZone(startsAt, TZ, "yyyy-MM-dd") === tomorrow ? "tomorrow" : formatInTimeZone(startsAt, TZ, "EEEE, MMM d");
  return `Hi ${first}, just a reminder: I'll call you ${day} at ${time} ET. Let me know if anything comes up and you need to reschedule.`;
}

export type MeetingRow = {
  id: string;
  contact_id: string;
  occurred_at: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
  contacts: { first_name: string; phone: string | null; opted_out_at: string | null; archived: boolean; spam: boolean } | null;
};

// Which reminders are due right now (pure - no sending).
export function dueReminders(meetings: MeetingRow[], liveEventIds: Set<string>, now: number): { meeting: MeetingRow; kind: Kind }[] {
  const due: { meeting: MeetingRow; kind: Kind }[] = [];
  for (const m of meetings) {
    const c = m.contacts;
    if (!c || !c.phone || c.opted_out_at || c.archived || c.spam) continue;
    const eventId = m.metadata?.google_event_id;
    if (typeof eventId === "string" && eventId && !liveEventIds.has(eventId)) continue;

    const start = new Date(m.occurred_at).getTime();
    const sinceBooked = now - new Date(m.created_at).getTime();
    const untilStart = start - now;
    for (const kind of ["24h", "1h"] as Kind[]) {
      const rule = RULES[kind];
      if (m.metadata?.[rule.key]) continue;
      if (untilStart > rule.before || untilStart <= rule.notWithin || sinceBooked < rule.quietAfterBooking) continue;
      // The 24h reminder never goes out once the 1h one is due.
      if (kind === "24h" && untilStart <= RULES["1h"].before) continue;
      due.push({ meeting: m, kind });
    }
  }
  return due;
}

export async function sendMeetingReminders(admin: SupabaseClient, ownerId: string): Promise<number> {
  const now = Date.now();
  const { data, error } = await admin
    .from("activities")
    .select("id, contact_id, occurred_at, created_at, metadata, contacts!inner(first_name, phone, opted_out_at, archived, spam)")
    .eq("owner_id", ownerId)
    .eq("type", "meeting")
    .gt("occurred_at", new Date(now).toISOString())
    .lte("occurred_at", new Date(now + 24 * HOUR).toISOString());
  if (error) throw new Error(`Couldn't load upcoming meetings for reminders: ${error.message}`);
  const meetings = (data ?? []) as unknown as MeetingRow[];
  if (meetings.length === 0) return 0;

  // Which are still on her Google Calendar (cancelled ones get no reminder).
  const needsCheck = meetings.some((m) => typeof m.metadata?.google_event_id === "string");
  const live = needsCheck
    ? new Set((await listUpcomingEvents(admin, ownerId, new Date(now).toISOString(), new Date(now + 25 * HOUR).toISOString())).map((e) => e.id))
    : new Set<string>();

  let sent = 0;
  for (const { meeting: m, kind } of dueReminders(meetings, live, now)) {
    const c = m.contacts!;
    const phone = c.phone!;
    const rule = RULES[kind];

    // Claim first so a retry or overlapping run can't double-send.
    const claimedAt = new Date().toISOString();
    const { error: claimError } = await admin
      .from("activities")
      .update({ metadata: { ...(m.metadata ?? {}), [rule.key]: claimedAt } })
      .eq("id", m.id);
    if (claimError) {
      await reportFailure("Couldn't record a meeting reminder (not sent, to avoid duplicates)", claimError.message, { contactId: m.contact_id });
      continue;
    }
    m.metadata = { ...(m.metadata ?? {}), [rule.key]: claimedAt };

    const body = reminderText(kind, c.first_name, m.occurred_at);
    const result = await sendQuoText(phone, body);
    if (!result.ok) {
      await reportFailure(`${kind === "24h" ? "24-hour" : "1-hour"} reminder text to ${c.first_name} failed`, result.error, { contactId: m.contact_id });
      continue;
    }
    await upsertActivity(admin, ownerId, m.contact_id, "quo", "quo_message_id", result.quoMessageId, {
      type: "text",
      direction: "outbound",
      occurred_at: new Date().toISOString(),
      body,
      metadata: { quo_message_id: result.quoMessageId, sent_from_crm: true, meeting_reminder: kind, meeting_activity_id: m.id },
    });
    sent++;
  }
  return sent;
}
