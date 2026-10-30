import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { formatDistanceToNowStrict } from "date-fns";

// Pages that show times are server-rendered, and the server runs in UTC -
// without an explicit timezone, dates would render in the server's zone
// instead of the agent's. This is a single-user app, so a fixed timezone
// (rather than per-viewer detection, which needs client-side rendering and
// causes SSR/hydration mismatches) is the simplest correct fix.
export const APP_TIMEZONE = "America/New_York";
export const APP_MARKET = "Atlanta";

export function formatLocal(date: string | Date, pattern: string): string {
  return formatInTimeZone(date, APP_TIMEZONE, pattern);
}

// date-fns's isToday() compares calendar days using the runtime's local
// clock (UTC on the server) - this compares calendar-day strings in the
// app's timezone instead, so "today" means today in EST, not UTC.
export function isTodayLocal(date: string | Date): boolean {
  return formatLocal(date, "yyyy-MM-dd") === formatLocal(new Date(), "yyyy-MM-dd");
}

export function isFollowUpOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now() && !isTodayLocal(iso);
}

// "2 hours ago" / "3 days ago" - for a row's meta line ("called 2 hours
// ago"), where a relative sense of recency reads faster than a date.
export function relativeTime(date: string | Date): string {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

// "12m" / "2h" / "1d" - the mobile Inbox row's right-aligned timestamp,
// deliberately shorter than relativeTime's "12 minutes ago" so it fits
// next to the name on a narrow row without crowding the preview text.
export function formatShortRelative(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// HTML <input type="date"> yields YYYY-MM-DD. The JS Date parser treats
// that as UTC midnight, which is still yesterday in America/New_York —
// so a follow-up picked as "today" landed on Today as overdue, and lead
// dates / task due dates drifted by a calendar day. Persist noon Eastern
// instead (DST-safe: transitions happen at 2am, never at noon) so the
// calendar day the agent typed is the calendar day the CRM uses.
export function dateInputToAppIso(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return new Date().toISOString();
  if (DATE_ONLY.test(trimmed)) {
    return fromZonedTime(`${trimmed}T12:00:00`, APP_TIMEZONE).toISOString();
  }
  return new Date(trimmed).toISOString();
}

export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  if (DATE_ONLY.test(iso)) return iso;
  // Old writes used `new Date("YYYY-MM-DD").toISOString()` = UTC midnight.
  // Keep showing that UTC calendar day so opening a contact and hitting
  // Save without touching the date doesn't silently move it. New writes
  // are noon Eastern, which is never 00:00:00Z.
  if (/T00:00:00(\.000)?Z$/.test(iso)) return iso.slice(0, 10);
  return formatLocal(iso, "yyyy-MM-dd");
}

export function endOfLocalDayIso(date = new Date()): string {
  const day = formatLocal(date, "yyyy-MM-dd");
  return fromZonedTime(`${day}T23:59:59.999`, APP_TIMEZONE).toISOString();
}

export function todayLocalDateInput(): string {
  return formatLocal(new Date(), "yyyy-MM-dd");
}

export function timeOfDayGreeting(date = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(formatLocal(date, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function addDaysIso(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
