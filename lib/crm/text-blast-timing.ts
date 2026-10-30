import { formatInTimeZone } from "date-fns-tz";

// Mirrors the actual cron cadence/batch size in lib/crm/text-blasts.ts and
// vercel.json's send-text-blasts schedule - keep these in sync if either
// changes.
export const TEXT_BLAST_SENDS_PER_RUN = 8;
export const TEXT_BLAST_RUN_INTERVAL_MINUTES = 15;

export function estimatedTextBlastMinutes(pendingCount: number): number {
  if (pendingCount <= 0) return 0;
  return Math.ceil(pendingCount / TEXT_BLAST_SENDS_PER_RUN) * TEXT_BLAST_RUN_INTERVAL_MINUTES;
}

// Nothing stopped a 6:40 AM send before this - blasts stagger over
// minutes, but had no floor on when that stagger could start. Holds
// pending sends until 9:00 AM Eastern; text_blasts.send_immediately
// (set by the composer's "Send now anyway" override) bypasses this.
export const QUIET_HOURS_START_HOUR = 9;
const TIMEZONE = "America/New_York";

export function isWithinQuietHours(now: Date = new Date()): boolean {
  const hour = Number(formatInTimeZone(now, TIMEZONE, "H"));
  return hour < QUIET_HOURS_START_HOUR;
}

// For the composer's own warning copy - "It's 6:41 AM - this will hold
// and start at 9:00 AM."
export function quietHoursEndLabel(): string {
  return `${QUIET_HOURS_START_HOUR}:00 AM`;
}
