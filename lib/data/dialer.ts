import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/utils";
import type { Contact } from "@/types/database";

export type DialerMode = "event-followup" | "confirmation";

export type DialerContact = Pick<
  Contact,
  | "id"
  | "first_name"
  | "last_name"
  | "phone"
  | "lead_source"
  | "last_event_name"
  | "last_event_at"
  | "created_at"
  | "dialer_snoozed_at"
  | "stage_id"
> & {
  // Confirmation queue only: the event name/account for this occurrence,
  // via lib/crm/dialer-mapping.ts's confirmationItemToDialerContact -
  // shown as the card's subtitle and fed into the pre-event templates.
  registrationLabel?: string | null;
  registrationAccount?: string | null;
  // Confirmation queue only: which occurrence this card is confirming
  // attendance for. The queue is keyed by (contact, event) rather than
  // just contact (see ConfirmationQueueItem), so DialerCallModal needs
  // these to know which event_confirmations row to act on and which
  // pre-event template reads naturally given how soon it is.
  confirmationEventId?: string;
  confirmationEventStart?: string;
  confirmationSource?: "registered" | "manual";
};

// A second, independent queue: people who actually attended (last_event_at
// is only set by a real Jotform check-in, distinct from just registering)
// and haven't had a follow-up call logged since. Deliberately separate
// tracking from the New Registrations queue above - someone can and
// should appear here even after already being called at registration,
// since it's a genuinely different touchpoint.
export async function listEventFollowupQueue(): Promise<{ contacts: DialerContact[]; error: string | null }> {
  const supabase = await createClient();

  const { data: candidates, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, phone, lead_source, last_event_name, last_event_at, created_at, event_followup_contacted_at, event_followup_snoozed_at, stage_id",
    )
    .eq("archived", false)
    .eq("known_personally", false)
    .not("last_event_at", "is", null)
    .not("phone", "is", null);

  if (error) return { contacts: [], error: error.message };
  if (!candidates || candidates.length === 0) return { contacts: [], error: null };

  // "Followed up" only counts if it happened at or after their most recent
  // event attendance. Without this, someone
  // who attended before, already got followed up on, then attended again
  // (or was marked attended for a new event) would never reappear here -
  // and doing the comparison at query time instead of clearing the column
  // on write means anyone already stuck from before this check existed
  // self-corrects immediately, no backfill needed.
  const eligible = candidates.filter(
    (c) => !c.event_followup_contacted_at || new Date(c.event_followup_contacted_at).getTime() < new Date(c.last_event_at as string).getTime(),
  );
  if (eligible.length === 0) return { contacts: [], error: null };

  // Reuse the same DialerContact/DialerCard shape (dialer_snoozed_at) so
  // the UI components stay agnostic of which queue they're rendering.
  const mapped = eligible.map((c) => ({
    ...c,
    dialer_snoozed_at: c.event_followup_snoozed_at,
  })) as DialerContact[];

  const sorted = mapped.sort((a, b) => {
    const aSnoozed = !!a.dialer_snoozed_at;
    const bSnoozed = !!b.dialer_snoozed_at;
    if (aSnoozed !== bSnoozed) return aSnoozed ? 1 : -1;
    if (aSnoozed && bSnoozed) return new Date(a.dialer_snoozed_at!).getTime() - new Date(b.dialer_snoozed_at!).getTime();
    return new Date(b.last_event_at as string).getTime() - new Date(a.last_event_at as string).getTime();
  });

  return { contacts: sorted, error: null };
}

export type ConfirmationQueueItem = Pick<Contact, "id" | "first_name" | "last_name" | "phone" | "stage_id"> & {
  eventId: string;
  eventName: string;
  eventStart: string;
  eventAccount: string | null;
  source: "registered" | "manual";
  confirmationSnoozedAt: string | null;
};

// A generous lookback for finding which registrations belong to an
// upcoming occurrence - real Eventbrite registrations for a given date
// open at most a few weeks out in practice, so 90 days comfortably covers
// it without scanning the entire history of eventbrite activities just to
// answer "what's happening in the next couple days."
const CONFIRMATION_LOOKBACK_DAYS = 90;
// A small grace window on the past side so an event starting earlier
// today doesn't vanish from the list the instant its start time passes -
// she may still be sending last-minute reminders as people arrive.
const CONFIRMATION_GRACE_HOURS = 12;
const CONFIRMATION_LOOKAHEAD_DAYS = 2;

// Third Dialer queue, distinct in shape from the other two: rows are keyed
// by (contact, event) rather than just contact, since the same person
// could in principle need confirming for two occurrences close together.
// Membership is two unions - everyone registered for a qualifying
// occurrence, plus anyone manually added via event_confirmations (source
// 'manual') for that same occurrence - minus anyone already confirmed
// (event_confirmations.confirmed_at set), same "handled = off the list"
// shape as the other two queues.
export type UpcomingConfirmationEvent = { eventId: string; eventName: string; eventStart: string };

export async function listConfirmationQueue(): Promise<{ items: ConfirmationQueueItem[]; events: UpcomingConfirmationEvent[]; error: string | null }> {
  const supabase = await createClient();

  const now = Date.now();
  const windowStart = new Date(now - CONFIRMATION_GRACE_HOURS * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + CONFIRMATION_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const lookback = new Date(now - CONFIRMATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentRegistrations, error: regError } = await supabase
    .from("activities")
    .select("contact_id, metadata")
    .eq("source", "eventbrite")
    .gte("occurred_at", lookback);
  if (regError) return { items: [], events: [], error: regError.message };

  const eventsById = new Map<string, { eventName: string; eventStart: string; eventAccount: string | null }>();
  const registeredContactIdsByEvent = new Map<string, Set<string>>();
  for (const row of recentRegistrations ?? []) {
    const metadata = row.metadata as Record<string, unknown> | null;
    const eventId = typeof metadata?.event_id === "string" ? metadata.event_id : null;
    const eventStart = typeof metadata?.event_start === "string" ? metadata.event_start : null;
    const eventName = typeof metadata?.event_name === "string" ? metadata.event_name : null;
    const eventAccount = typeof metadata?.eventbrite_account === "string" ? metadata.eventbrite_account : null;
    if (!eventId || !eventStart || !eventName) continue;
    if (!eventsById.has(eventId)) eventsById.set(eventId, { eventName, eventStart, eventAccount });
    if (!registeredContactIdsByEvent.has(eventId)) registeredContactIdsByEvent.set(eventId, new Set());
    registeredContactIdsByEvent.get(eventId)!.add(row.contact_id as string);
  }

  const qualifyingEventIds = [...eventsById.entries()]
    .filter(([, e]) => e.eventStart >= windowStart && e.eventStart <= windowEnd)
    .map(([eventId]) => eventId)
    .sort((a, b) => eventsById.get(a)!.eventStart.localeCompare(eventsById.get(b)!.eventStart));

  const events: UpcomingConfirmationEvent[] = qualifyingEventIds.map((eventId) => ({
    eventId,
    eventName: eventsById.get(eventId)!.eventName,
    eventStart: eventsById.get(eventId)!.eventStart,
  }));
  if (qualifyingEventIds.length === 0) return { items: [], events: [], error: null };

  const { data: confirmationRows, error: confError } = await supabase
    .from("event_confirmations")
    .select("event_id, contact_id, source, confirmed_at, snoozed_at")
    .in("event_id", qualifyingEventIds);
  if (confError) return { items: [], events, error: confError.message };

  const statusByPair = new Map<string, { confirmedAt: string | null; snoozedAt: string | null }>();
  const manualContactIdsByEvent = new Map<string, Set<string>>();
  for (const row of confirmationRows ?? []) {
    statusByPair.set(`${row.event_id}:${row.contact_id}`, { confirmedAt: row.confirmed_at, snoozedAt: row.snoozed_at });
    if (row.source === "manual") {
      if (!manualContactIdsByEvent.has(row.event_id)) manualContactIdsByEvent.set(row.event_id, new Set());
      manualContactIdsByEvent.get(row.event_id)!.add(row.contact_id);
    }
  }

  const allContactIds = new Set<string>();
  for (const eventId of qualifyingEventIds) {
    for (const id of registeredContactIdsByEvent.get(eventId) ?? []) allContactIds.add(id);
    for (const id of manualContactIdsByEvent.get(eventId) ?? []) allContactIds.add(id);
  }
  if (allContactIds.size === 0) return { items: [], events, error: null };

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, stage_id")
    .in("id", [...allContactIds])
    .eq("archived", false)
    .eq("known_personally", false)
    .is("opted_out_at", null)
    .not("phone", "is", null);
  if (contactsError) return { items: [], events, error: contactsError.message };

  const contactById = new Map(contacts?.map((c) => [c.id, c]) ?? []);

  const items: ConfirmationQueueItem[] = [];
  for (const eventId of qualifyingEventIds) {
    const event = eventsById.get(eventId)!;
    const contactIds = new Set([...(registeredContactIdsByEvent.get(eventId) ?? []), ...(manualContactIdsByEvent.get(eventId) ?? [])]);
    for (const contactId of contactIds) {
      const contact = contactById.get(contactId);
      if (!contact) continue;
      const status = statusByPair.get(`${eventId}:${contactId}`);
      if (status?.confirmedAt) continue;
      items.push({
        ...contact,
        eventId,
        eventName: event.eventName,
        eventStart: event.eventStart,
        eventAccount: event.eventAccount,
        source: manualContactIdsByEvent.get(eventId)?.has(contactId) ? "manual" : "registered",
        confirmationSnoozedAt: status?.snoozedAt ?? null,
      });
    }
  }

  items.sort((a, b) => {
    if (a.eventStart !== b.eventStart) return a.eventStart.localeCompare(b.eventStart);
    const aSnoozed = !!a.confirmationSnoozedAt;
    const bSnoozed = !!b.confirmationSnoozedAt;
    if (aSnoozed !== bSnoozed) return aSnoozed ? 1 : -1;
    return fullName(a).localeCompare(fullName(b));
  });

  return { items, events, error: null };
}

// The actual search function lives in app/(app)/dialer/actions.ts (a "use
// server" server action) rather than here - this file gets imported by
// client components for its types, and a plain async function here would
// pull the server-only Supabase client into the client bundle the moment
// anything else in this file (which does import it) got bundled alongside.
export type ConfirmationSearchResult = { id: string; name: string; phone: string | null };
