import { PrepSheetCard } from "@/components/dashboard/PrepSheetCard";
import { WeeklyReviewCard } from "@/components/dashboard/WeeklyReviewCard";
import { TodayQueuePanel } from "@/components/dashboard/TodayQueuePanel";
import { TodayDesktop } from "@/components/dashboard/TodayDesktop";
import { TodayHome } from "@/components/dashboard/TodayHome";
import { buildTodayPersonGroups, parseTodayFocus, type TodayChipKey } from "@/lib/crm/today-focus";
import type { getTodayData } from "@/lib/data/today";
import type { WeeklyReviewPayload } from "@/lib/data/weekly-review";
import type { PrepSheetPayload } from "@/lib/data/prep-sheet";
import type { MergeCandidate } from "@/lib/data/contacts";

type Today = Awaited<ReturnType<typeof getTodayData>>;

export function TodayScreen({
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
    <div className="relative min-h-full overflow-x-hidden bg-[#f7f1ea]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#e8cfc4]/45 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f3e6dc]/70 to-transparent"
      />

      <div className="relative overflow-x-hidden px-5 py-5 lg:hidden">
        {!parsedFocus && activePrepSheets.length > 0 && (
          <div className="mb-5 space-y-3">
            {activePrepSheets.map((p) => (
              <PrepSheetCard key={p.id} id={p.id} payload={p.payload as unknown as PrepSheetPayload} />
            ))}
          </div>
        )}

        {!parsedFocus && pinnedWeeklyReview && (
          <div className="mb-5">
            <WeeklyReviewCard id={pinnedWeeklyReview.id} payload={pinnedWeeklyReview.payload} />
          </div>
        )}

        {today.newLeadsError && !parsedFocus && (
          <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

      <div className="relative hidden overflow-x-hidden lg:block">
        <TodayDesktop
          today={today}
          contacts={contacts}
          ownerId={ownerId}
          ownerFirstName={ownerFirstName}
          activePrepSheets={activePrepSheets}
          pinnedWeeklyReview={pinnedWeeklyReview}
          focus={focus}
          initialChip={initialChip}
        />
      </div>
    </div>
  );
}
