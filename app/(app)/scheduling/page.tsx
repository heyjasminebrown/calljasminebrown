import Link from "next/link";
import {
  listBookingCalendars,
  listPendingBookingRequests,
  listProposedBookingRequests,
  listAbandonedBookingSessions,
} from "@/lib/data/scheduling";
import { listUpcomingMeetings } from "@/lib/data/meetings";
import { Section } from "@/components/ui/Section";
import { BookingRequestRow } from "@/components/scheduling/BookingRequestRow";
import { ProposedRequestRow } from "@/components/scheduling/ProposedRequestRow";
import { AbandonedSessionRow } from "@/components/scheduling/AbandonedSessionRow";
import { BookingCalendarsPanel } from "@/components/scheduling/BookingCalendarsPanel";
import { CalendarStatus } from "@/components/scheduling/CalendarStatus";
import { baseUrl } from "@/lib/crm/sequences";
import { formatLocal } from "@/lib/format-time";
import { PUBLIC_BOOKING_URL } from "@/lib/brand/identity";

export default async function SchedulingPage() {
  const [calendars, pending, proposed, upcoming, abandoned] = await Promise.all([
    listBookingCalendars(),
    listPendingBookingRequests(),
    listProposedBookingRequests(),
    listUpcomingMeetings({ days: 60 }),
    listAbandonedBookingSessions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-[28px]">Schedule</h1>
      <p className="mt-1 text-[15px] text-neutral-500">Your booking calendars and every meeting on the books.</p>

      <div className="mt-4 space-y-3">
        {pending.length > 0 && (
          <Section sectionKey="scheduling:pending" title="Needs your approval" meta={`${pending.length}`} defaultOpen>
            <p className="px-4 pt-3 text-xs text-neutral-500">These couldn&apos;t be added to Google Calendar automatically. Approve to send the invite.</p>
            {pending.map((r) => (
              <BookingRequestRow key={r.id} request={r} />
            ))}
          </Section>
        )}

        {proposed.length > 0 && (
          <Section sectionKey="scheduling:proposed" title="Waiting on their confirmation" meta={`${proposed.length}`} defaultOpen>
            {proposed.map((r) => (
              <ProposedRequestRow key={r.id} request={r} />
            ))}
          </Section>
        )}

        <Section sectionKey="scheduling:calendars" title="Booking calendars" meta={`${calendars.calendars.filter((c) => c.active).length} on`} defaultOpen>
          {calendars.error ? (
            <p className="px-4 py-4 text-sm font-medium text-red-600">Couldn&apos;t load your calendars: {calendars.error}</p>
          ) : (
            <BookingCalendarsPanel calendars={calendars.calendars} publicBase={PUBLIC_BOOKING_URL} crmBase={baseUrl()} />
          )}
        </Section>

        <Section sectionKey="scheduling:connected" title="Connected calendars" meta="Google + Outlook" defaultOpen>
          <CalendarStatus />
        </Section>

        <Section sectionKey="scheduling:upcoming" title="Upcoming meetings" meta={`${upcoming.meetings.length}`} defaultOpen>
          {upcoming.error ? (
            <p className="px-4 py-4 text-sm font-medium text-red-600">Couldn&apos;t load meetings: {upcoming.error}</p>
          ) : upcoming.meetings.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-neutral-400">Nothing booked yet.</p>
          ) : (
            upcoming.meetings.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <Link href={`/contacts/${m.contactId}`} className="text-[15px] font-semibold text-neutral-900 hover:underline">
                    {m.contactName}
                  </Link>
                  <p className="text-sm text-neutral-500">{formatLocal(m.startsAt, "EEE, MMM d 'at' h:mm a")}</p>
                  <p className="truncate text-xs text-neutral-400">{m.title}</p>
                </div>
              </div>
            ))
          )}
        </Section>

        <Section sectionKey="scheduling:abandoned" title="Started but didn't book" meta={`${abandoned.length}`} defaultOpen={false}>
          {abandoned.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-neutral-400">Nobody&apos;s dropped off recently.</p>
          ) : (
            abandoned.map((r) => <AbandonedSessionRow key={r.id} request={r} />)
          )}
        </Section>
      </div>
    </div>
  );
}
