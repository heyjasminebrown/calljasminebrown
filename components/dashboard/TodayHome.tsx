import { TodaySearch } from "@/components/dashboard/mobile/TodaySearch";
import { TodayPipelineOverview } from "@/components/dashboard/TodayPipelineOverview";
import { TextAndNextDialer } from "@/components/dashboard/TextAndNextDialer";
import { TodayAbandonedBookingCard } from "@/components/dashboard/TodayAbandonedBookingCard";
import { TodayBookingRequestCard } from "@/components/dashboard/TodayBookingRequestCard";
import { TodayUpcomingEvents } from "@/components/dashboard/TodayUpcomingEvents";
import { TodayTodosCard } from "@/components/dashboard/TodayTodosCard";
import { TODAY_GRID, TODAY_LABEL, TODAY_STACK_DESKTOP } from "@/components/dashboard/today-home-layout";
import { timeOfDayGreeting } from "@/lib/format-time";
import { buildTextAndNextLeads, openTasksForToday } from "@/lib/crm/today-v1";
import { cn } from "@/lib/utils";
import { OWNER_FIRST_NAME } from "@/lib/brand/identity";
import type { getTodayData } from "@/lib/data/today";
import type { MergeCandidate } from "@/lib/data/contacts";

export function TodayHome({
  today,
  contacts,
  ownerFirstName,
}: {
  today: Awaited<ReturnType<typeof getTodayData>>;
  contacts: MergeCandidate[];
  ownerFirstName: string;
}) {
  const greeting = timeOfDayGreeting();
  const leads = buildTextAndNextLeads(today.newLeads);
  const upcoming = today.calendar.slice(0, 2);
  const tasks = openTasksForToday(today.myTasks);

  return (
    <div className={cn(TODAY_STACK_DESKTOP, "overflow-x-hidden")}>
      <div className="flex min-w-0 items-start justify-between gap-3 lg:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate whitespace-nowrap font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-neutral-900 lg:text-[32px] xl:text-[40px]">
            {greeting}, {ownerFirstName || OWNER_FIRST_NAME}
          </h1>
          <p className="mt-1 truncate text-[14px] text-neutral-500 lg:mt-1.5 lg:text-[15px]">Here&apos;s who needs you today.</p>
        </div>
        <TodaySearch contacts={contacts} />
      </div>
      {today.newLeadsError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load new leads: {today.newLeadsError}
        </p>
      )}
      <div className={TODAY_GRID}>
        <div className="col-span-12 min-w-0 md:col-span-6">
          <TodayPipelineOverview stages={today.stages} counts={today.statStrip.stageCounts} />
        </div>
        <div className="col-span-12 min-w-0 md:col-span-6">
          <TodayTodosCard tasks={tasks} />
        </div>
      </div>
      <section data-today-home="needs-you" className="flex min-w-0 flex-col gap-3">
        <h2 className={TODAY_LABEL}>Needs you</h2>
        {today.bookingRequests.map((request) => (
          <TodayBookingRequestCard key={request.id} request={request} />
        ))}
        {today.abandonedBookings.map((request) => (
          <TodayAbandonedBookingCard key={request.id} request={request} />
        ))}
        <div data-today-home="spotlight" className="contents">
          <TextAndNextDialer leads={leads} />
        </div>
      </section>
      {upcoming.length > 0 && <TodayUpcomingEvents items={upcoming} />}
    </div>
  );
}
