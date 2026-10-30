import { formatInTimeZone } from "date-fns-tz";

// Pure, no server-only imports - same reasoning as quote-message.ts:
// real values inlined, not merge tokens, since these are always one-off
// sends triggered from an approve/decline action, never a bulk blast.
const APP_TIMEZONE = "America/New_York";

function describeWhen(startsAtIso: string): string {
  return formatInTimeZone(startsAtIso, APP_TIMEZONE, "EEEE, MMM d 'at' h:mm a");
}

export function buildBookingConfirmedMessage(input: { visitorFirstName: string; startsAt: string; meetLink: string | null }): string {
  const when = describeWhen(input.startsAt);
  const meet = input.meetLink ? ` Video call link: ${input.meetLink}` : "";
  return `Thanks for booking - looking forward to meeting with you on ${when}!${meet}`;
}

export function buildBookingDeclinedMessage(input: { visitorFirstName: string; startsAt: string; rebookLink: string }): string {
  const when = describeWhen(input.startsAt);
  return `Hi ${input.visitorFirstName}, sorry - ${when} doesn't work after all. Mind grabbing another time here? ${input.rebookLink}`;
}

// Sent when she proposes a different time instead of a flat decline - the
// visitor confirms through confirmLink themselves, which is what actually
// books it (see app/confirm/[token]).
export function buildProposeNewTimeMessage(input: { visitorFirstName: string; originalStartsAt: string; proposedStartsAt: string; confirmLink: string }): string {
  const originalWhen = describeWhen(input.originalStartsAt);
  const proposedWhen = describeWhen(input.proposedStartsAt);
  return `Hi ${input.visitorFirstName}, I'm so sorry, something came up for ${originalWhen}. Would ${proposedWhen} work instead? If yes, please confirm here and it'll send the calendar invite: ${input.confirmLink} Thank you!`;
}

export function buildSchedulingLinkMessage(input: { firstName: string; link: string }): string {
  return `Hi ${input.firstName}, here's a link to grab time on my calendar: ${input.link}`;
}
