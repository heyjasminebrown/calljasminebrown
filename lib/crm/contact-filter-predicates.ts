// Pure Contacts filter predicates. UI labels must match these — never the
// other way around. No Supabase/next-headers so client controls and the
// proof script can import this without pulling the server graph.
//
// URL contract (see contact-filter-params.ts):
//   regEvent missing/empty  → no registration filter (Contacts v2: all sources)
//   regEvent=__any__        → registered for any event (Eventbrite / CRM signup)
//   regEvent=__all__        → no registration filter (Anyone, including call-only)
//   regEvent=<event name>   → registered for that specific event
//
// "Registered" is an activity, not a contact_type and not a call log.
// Eventbrite orders and the CRM Eventbrite CSV import write source=eventbrite.
// Inbound Quo calls write source=quo / type=call and must never match.

import { EVER_ATTENDED_EVENT, REGISTERED_FOR_ANY_EVENT } from "./contact-filter-params";

export const EVENT_REGISTRATION_SOURCE = "eventbrite";
export const EVENT_ATTENDANCE_SOURCES = ["jotform", "checkin"] as const;

export type EventActivityRef = {
  contactId: string;
  eventName: string | null;
  source: string;
};

export function eventNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const name = (metadata as Record<string, unknown>).event_name;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isEventRegistrationSource(source: string): boolean {
  return source === EVENT_REGISTRATION_SOURCE;
}

export function isEventAttendanceSource(source: string): boolean {
  return (EVENT_ATTENDANCE_SOURCES as readonly string[]).includes(source);
}

export function isAnyEventRegistrationFilter(registeredEventName: string | undefined): boolean {
  return registeredEventName === REGISTERED_FOR_ANY_EVENT;
}

export function hasUsablePhone(phone: string | null | undefined): boolean {
  return !!phone?.trim();
}

// True when this activity is the owner following up (a call/text/email),
// not when the other party inbound-called. Inbound robocalls must not count
// as "follow-up" on the Registered-no-follow-up / gone-quiet queues.
export function isOutboundOutreach(row: { type: string; direction?: string | null }): boolean {
  if (row.type !== "call" && row.type !== "text" && row.type !== "email") return false;
  return row.direction === "outbound";
}

export function isAnyOutreach(row: { type: string }): boolean {
  return row.type === "call" || row.type === "text" || row.type === "email";
}

export function registeredContactIds(registeredEventName: string, registrations: EventActivityRef[]): Set<string> {
  const any = isAnyEventRegistrationFilter(registeredEventName);
  const ids = new Set<string>();
  for (const row of registrations) {
    if (!isEventRegistrationSource(row.source)) continue;
    if (any || row.eventName === registeredEventName) ids.add(row.contactId);
  }
  return ids;
}

// Tess combo: Registered for any event + Has a phone number.
// contact_type is a label, not this gate. Call-only Other (Austin Sizemore)
// has a phone and no Eventbrite/CRM signup, so this is false.
export function contactMatchesRegisteredAnyAndHasPhone(
  contact: { id: string; phone?: string | null; contact_type?: string },
  registrations: EventActivityRef[],
): boolean {
  if (!hasUsablePhone(contact.phone)) return false;
  return registeredContactIds(REGISTERED_FOR_ANY_EVENT, registrations).has(contact.id);
}

// "Attended: {event}" must match anyone who checked in at that event, not
// only contacts whose last_event_name still happens to be that title
// (attending a later meetup would otherwise hide them from the earlier one).
export function isEverAttendedFilter(eventName: string | undefined): boolean {
  return eventName === EVER_ATTENDED_EVENT;
}

export function attendedContactIds(
  eventName: string,
  contacts: { id: string; last_event_name?: string | null }[],
  attendance: EventActivityRef[],
): Set<string> {
  const any = isEverAttendedFilter(eventName);
  const ids = new Set<string>();
  for (const c of contacts) {
    if (any ? !!c.last_event_name : c.last_event_name === eventName) ids.add(c.id);
  }
  for (const row of attendance) {
    if (!isEventAttendanceSource(row.source)) continue;
    if (any ? !!row.eventName : row.eventName === eventName) ids.add(row.contactId);
  }
  return ids;
}
