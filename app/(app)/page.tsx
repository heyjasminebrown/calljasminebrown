import { getTodayData } from "@/lib/data/today";
import { listMergeCandidates } from "@/lib/data/contacts";
import { createClient } from "@/lib/supabase/server";
import { TodayScreen } from "@/components/dashboard/TodayScreen";
import { firstNameFromProfile } from "@/lib/utils";
import { FOCUS_TO_CHIP, parseTodayFocus } from "@/lib/crm/today-focus";
import { filterResolvedWeeklyReviewItems, type WeeklyReviewPayload } from "@/lib/data/weekly-review";
import type { PrepSheetPayload } from "@/lib/data/prep-sheet";
import { getScorecard, parseScorecardPeriod } from "@/lib/data/scorecard";
import type { ScorecardResult } from "@/components/dashboard/TodayScorecard";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ focus?: string; period?: string }> }) {
  const { focus, period: periodParam } = await searchParams;
  const period = parseScorecardPeriod(periodParam);
  const parsedFocus = parseTodayFocus(focus);
  const initialChip = parsedFocus ? FOCUS_TO_CHIP[parsedFocus] : undefined;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    today,
    contacts,
    { data: pinnedWeeklyReview },
    { data: pinnedPrepSheets },
    scorecard,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getTodayData(),
    listMergeCandidates(),
    supabase.from("pinned_today_items").select("id, payload").eq("kind", "weekly_review").is("cleared_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pinned_today_items").select("id, payload").eq("kind", "prep_sheet").is("cleared_at", null).order("created_at", { ascending: false }).limit(5),
    // An error here shows on the cards themselves instead of breaking Today.
    getScorecard(period).then(
      (data): ScorecardResult => ({ period, data, error: null }),
      (err: unknown): ScorecardResult => ({ period, data: null, error: err instanceof Error ? err.message : String(err) }),
    ),
  ]);

  const activePrepSheets = (pinnedPrepSheets ?? []).filter((p) => new Date((p.payload as unknown as PrepSheetPayload).startAt).getTime() > Date.now());

  const ownerId = user?.id ?? "";
  const ownerFirstName = firstNameFromProfile(user);

  const resolvedWeeklyReview = pinnedWeeklyReview
    ? { id: pinnedWeeklyReview.id, payload: await filterResolvedWeeklyReviewItems(supabase, ownerId, pinnedWeeklyReview.payload as unknown as WeeklyReviewPayload) }
    : null;

  return (
    <TodayScreen
      today={today}
      contacts={contacts}
      ownerId={ownerId}
      ownerFirstName={ownerFirstName}
      activePrepSheets={activePrepSheets}
      pinnedWeeklyReview={resolvedWeeklyReview}
      focus={focus}
      initialChip={initialChip}
      scorecard={scorecard}
    />
  );
}
