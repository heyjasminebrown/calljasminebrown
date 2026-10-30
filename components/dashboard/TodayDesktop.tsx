import { PrepSheetCard } from "@/components/dashboard/PrepSheetCard";
import { WeeklyReviewCard } from "@/components/dashboard/WeeklyReviewCard";
import { TodayQueuePanel } from "@/components/dashboard/TodayQueuePanel";
import { TodayHome } from "@/components/dashboard/TodayHome";
import { buildTodayPersonGroups, parseTodayFocus, type TodayChipKey } from "@/lib/crm/today-focus";
import type { getTodayData } from "@/lib/data/today";
import type { WeeklyReviewPayload } from "@/lib/data/weekly-review";
import type { PrepSheetPayload } from "@/lib/data/prep-sheet";
import type { MergeCandidate } from "@/lib/data/contacts";

type Today = Awaited<ReturnType<typeof getTodayData>>;

export function TodayDesktop({
  today,
  contacts,
  ownerId,
  ownerFirstName,
  activePrepSheets,
  pinnedWeeklyReview,
  focus,
  initialChip,
}: {
  today: Today;
  contacts: MergeCandidate[];
  ownerId: string;
  ownerFirstName: string;
  activePrepSheets: { id: string; payload: unknown }[];
  pinnedWeeklyReview: { id: string; payload: WeeklyReviewPayload } | null;
  focus?: string;
  initialChip?: TodayChipKey;
}) {
  const groups = buildTodayPersonGroups(today);
  const parsedFocus = parseTodayFocus(focus);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] overflow-x-hidden px-8 py-8">
      {!parsedFocus && activePrepSheets.length > 0 && (
        <div className="mb-6 grid gap-3 lg:grid-cols-2">
          {activePrepSheets.map((p) => (
            <PrepSheetCard key={p.id} id={p.id} payload={p.payload as unknown as PrepSheetPayload} />
          ))}
        </div>
      )}

      {!parsedFocus && pinnedWeeklyReview && (
        <div className="mb-6">
          <WeeklyReviewCard id={pinnedWeeklyReview.id} payload={pinnedWeeklyReview.payload} />
        </div>
      )}

      {today.newLeadsError && !parsedFocus && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load new leads: {today.newLeadsError}
        </p>
      )}

      {parsedFocus ? (
        <TodayQueuePanel
          key={parsedFocus}
          focus={parsedFocus}
          initialChip={initialChip}
          groups={groups}
          tasks={today.myTasks}
          ownerId={ownerId}
          contacts={contacts}
          bookingRequests={today.bookingRequests}
          newLeadsError={today.newLeadsError}
        />
      ) : (
        <TodayHome today={today} contacts={contacts} ownerFirstName={ownerFirstName} />
      )}
    </div>
  );
}
