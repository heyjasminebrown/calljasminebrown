// Period options for the scorecard (Today cards and Reports). No server
// imports, so client components can use these too.

import { fromZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";

export type ScorecardPeriod = "7d" | "30d" | "90d" | "this_month" | "last_month" | "year";

export const SCORECARD_PERIOD_LABELS: Record<ScorecardPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  this_month: "This month",
  last_month: "Last month",
  year: "This year",
};

export function parseScorecardPeriod(raw: string | undefined | null, fallback: ScorecardPeriod = "30d"): ScorecardPeriod {
  return raw && raw in SCORECARD_PERIOD_LABELS ? (raw as ScorecardPeriod) : fallback;
}

// Month/year boundaries are Eastern-time midnights, not UTC.
export function localMonthStart(year: number, monthIndex: number): Date {
  return fromZonedTime(new Date(year, monthIndex, 1, 0, 0, 0), APP_TIMEZONE);
}
