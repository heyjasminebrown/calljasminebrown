import type { AvailabilitySettings } from "@/lib/crm/booking-availability";
import type { BookingCalendar, DayHours, TimeRange, WeeklyHours, Weekday } from "@/types/database";

// A day's bookable windows, earliest first.
export function dayRanges(hours: DayHours): TimeRange[] {
  const ranges = hours.ranges?.length ? hours.ranges : [{ start: hours.start, end: hours.end }];
  return [...ranges].sort((a, b) => a.start.localeCompare(b.start));
}

// Sets a day's windows (keeping start/end = first start / last end).
export function withRanges(day: DayHours, ranges: TimeRange[]): DayHours {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  return { ...day, ranges: sorted, start: sorted[0]?.start ?? day.start, end: sorted[sorted.length - 1]?.end ?? day.end };
}

// Pure helpers shared by the Schedule tab (client) and the public booking
// page (server). No server-only imports.

export const DAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: { enabled: true, start: "10:00", end: "18:00" },
  tue: { enabled: true, start: "10:00", end: "18:00" },
  wed: { enabled: true, start: "10:00", end: "18:00" },
  thu: { enabled: true, start: "10:00", end: "18:00" },
  fri: { enabled: true, start: "10:00", end: "18:00" },
  sat: { enabled: false, start: "10:00", end: "18:00" },
  sun: { enabled: false, start: "10:00", end: "18:00" },
};

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function availabilityFor(calendar: BookingCalendar): AvailabilitySettings {
  return {
    durationMinutes: calendar.duration_minutes,
    daysOut: calendar.days_out,
    visibleSlotPct: 100,
    bufferMinutes: calendar.buffer_minutes,
    weeklyHours: calendar.weekly_hours,
    minNoticeHours: calendar.min_notice_hours,
    slotIntervalMinutes: calendar.slot_interval_minutes,
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

function rangesLabel(day: DayHours) {
  return dayRanges(day)
    .map((r) => `${fmtTime(r.start)}-${fmtTime(r.end)}`)
    .join(", ");
}

// "Mon-Fri, 9 AM-12 PM, 2 PM-4 PM" style summary for the calendar cards.
export function hoursSummary(hours: WeeklyHours): string {
  const on = DAY_ORDER.filter((d) => hours[d]?.enabled);
  if (on.length === 0) return "No days available";
  const label = rangesLabel(hours[on[0]]);
  const same = on.every((d) => rangesLabel(hours[d]) === label);
  const idx = on.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const days = contiguous && on.length > 2 ? `${DAY_LABELS[on[0]]}-${DAY_LABELS[on[on.length - 1]]}` : on.map((d) => DAY_LABELS[d]).join(", ");
  return same ? `${days}, ${label}` : `${days} (varied hours)`;
}

export type CalendarInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  slotIntervalMinutes: number | null;
  weeklyHours: WeeklyHours;
  daysOut: number;
  bufferMinutes: number;
  minNoticeHours: number;
  active: boolean;
};

export function validateCalendar(input: CalendarInput): string | null {
  if (!input.name.trim()) return "Give the calendar a name.";
  if (!SLUG_PATTERN.test(input.slug)) return "The link can only use lowercase letters, numbers and dashes (like intro-call).";
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 5 || input.durationMinutes > 480) return "Length must be between 5 and 480 minutes.";
  if (input.slotIntervalMinutes != null && (input.slotIntervalMinutes < 5 || input.slotIntervalMinutes > 240)) return "Start times must be 5 to 240 minutes apart.";
  if (input.daysOut < 1 || input.daysOut > 180) return "People can book 1 to 180 days ahead.";
  if (input.bufferMinutes < 0 || input.bufferMinutes > 240) return "Buffer must be 0 to 240 minutes.";
  if (input.minNoticeHours < 0 || input.minNoticeHours > 336) return "Minimum notice must be 0 to 336 hours.";
  const on = DAY_ORDER.filter((d) => input.weeklyHours[d]?.enabled);
  if (on.length === 0) return "Turn on at least one day.";
  for (const d of on) {
    const ranges = dayRanges(input.weeklyHours[d]);
    if (ranges.length === 0) return `${DAY_LABELS[d]}: add at least one time range, or uncheck the day.`;
    for (const [i, { start, end }] of ranges.entries()) {
      if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start >= end) return `${DAY_LABELS[d]}: each end time must be after its start time.`;
      if (i > 0 && start < ranges[i - 1].end) return `${DAY_LABELS[d]}: the time ranges overlap (${fmtTime(ranges[i - 1].start)}-${fmtTime(ranges[i - 1].end)} and ${fmtTime(start)}-${fmtTime(end)}).`;
    }
  }
  return null;
}
