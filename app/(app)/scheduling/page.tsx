import Link from "next/link";
import {
  getSchedulingSettings,
  listPendingBookingRequests,
  listProposedBookingRequests,
  listUpcomingApprovedBookingRequests,
  listAbandonedBookingSessions,
} from "@/lib/data/scheduling";
import { Section } from "@/components/ui/Section";
import { BookingRequestRow } from "@/components/scheduling/BookingRequestRow";
import { ProposedRequestRow } from "@/components/scheduling/ProposedRequestRow";
import { AbandonedSessionRow } from "@/components/scheduling/AbandonedSessionRow";
import { SchedulingSettingsCard } from "@/components/scheduling/SchedulingSettingsCard";
import { baseUrl } from "@/lib/crm/sequences";
import { formatLocal } from "@/lib/format-time";

export default async function SchedulingPage() {
  const [settings, pending, proposed, upcoming, abandoned] = await Promise.all([
    getSchedulingSettings(),
    listPendingBookingRequests(),
    listProposedBookingRequests(),
    listUpcomingApprovedBookingRequests(),
    listAbandonedBookingSessions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-[28px]">Bookings</h1>
      <p className="mt-1 text-[15px] text-neutral-500">
        History and settings. New call requests wait in{" "}
        <Link href="/" className="font-medium text-brand-700 hover:underline">
          Today → Needs you
        </Link>
        , not only here.
      </p>

      <div className="mt-4 space-y-3">
        <Section sectionKey="scheduling:pending" title="Still open (also on Today)" meta={`${pending.length}`} defaultOpen={false}>
          {pending.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-neutral-400">Nothing waiting on you.</p>
          ) : (
            pending.map((r) => <BookingRequestRow key={r.id} request={r} />)
          )}
        </Section>

        {proposed.length > 0 && (
          <Section sectionKey="scheduling:proposed" title="Waiting on their confirmation" meta={`${proposed.length}`} defaultOpen>
            {proposed.map((r) => (
              <ProposedRequestRow key={r.id} request={r} />
            ))}
          </Section>
        )}

        <Section sectionKey="scheduling:abandoned" title="Started but didn't book" meta={`${abandoned.length}`} defaultOpen={abandoned.length > 0}>
          {abandoned.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-neutral-400">Nobody&apos;s dropped off recently.</p>
          ) : (
            abandoned.map((r) => <AbandonedSessionRow key={r.id} request={r} />)
          )}
        </Section>

        <Section sectionKey="scheduling:upcoming" title="Upcoming" meta={`${upcoming.length}`} defaultOpen={false}>
          {upcoming.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-neutral-400">Nothing booked yet.</p>
          ) : (
            upcoming.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 last:border-b-0">
                <div>
                  <p className="text-[15px] font-semibold text-neutral-900">{r.contact_name || r.visitor_name}</p>
                  {r.starts_at && <p className="text-sm text-neutral-500">{formatLocal(r.starts_at, "EEE, MMM d 'at' h:mm a")}</p>}
                </div>
              </div>
            ))
          )}
        </Section>

        <Section sectionKey="scheduling:settings" title="Settings" defaultOpen={false}>
          {settings && <SchedulingSettingsCard settings={settings} genericLink={`${baseUrl()}/book`} />}
        </Section>
      </div>
    </div>
  );
}
