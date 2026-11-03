import ical, { type VEvent } from "node-ical";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { reportFailure } from "@/lib/errors/report-failure";

// Her Outlook work calendar (jbrown@cvlending.com), published from Outlook
// on the web as an ICS link ("Can view when I'm busy") and saved in Vercel
// as OUTLOOK_CALENDAR_ICS_URL. Read-only: used so the booking page never
// offers a time she's busy in Outlook.

export type BusyBlock = { start: number; end: number };

const APP_TZ = "America/New_York";
const CACHE_MS = 2 * 60 * 1000;
let cache: { at: number; text: string } | null = null;

export function isOutlookCalendarConfigured(): boolean {
  return !!process.env.OUTLOOK_CALENDAR_ICS_URL;
}

async function fetchIcs(): Promise<string | null> {
  const raw = process.env.OUTLOOK_CALENDAR_ICS_URL;
  if (!raw) return null;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;
  // Outlook hands out webcal:// links sometimes; they're plain https.
  const url = raw.trim().replace(/^webcal:\/\//i, "https://");
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "text/calendar" } });
  if (!res.ok) throw new Error(`Outlook calendar link returned ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Outlook calendar link didn't return a calendar (check it's the ICS link, not the HTML one)");
  cache = { at: Date.now(), text };
  return text;
}

type Flagged = Date & { dateOnly?: boolean };

// Free / tentative-free time and cancelled events don't block anything.
function blocksTime(ev: VEvent): boolean {
  if (ev.status === "CANCELLED") return false;
  if (ev.transparency === "TRANSPARENT") return false;
  const busyStatus = String((ev as unknown as Record<string, unknown>)["MICROSOFT-CDO-BUSYSTATUS"] ?? "").toUpperCase();
  if (busyStatus === "FREE" || busyStatus === "WORKINGELSEWHERE") return false;
  return true;
}

// An all-day entry covers whole days on her (Eastern) calendar.
function allDayBlock(start: Flagged, end: Flagged | undefined): BusyBlock {
  const startKey = formatInTimeZone(start, "UTC", "yyyy-MM-dd");
  const endKey = end ? formatInTimeZone(end, "UTC", "yyyy-MM-dd") : null;
  const s = fromZonedTime(`${startKey} 00:00:00`, APP_TZ).getTime();
  const e = endKey && endKey > startKey ? fromZonedTime(`${endKey} 00:00:00`, APP_TZ).getTime() : s + 24 * 60 * 60 * 1000;
  return { start: s, end: e };
}

export function busyBlocksFromIcs(text: string, timeMin: number, timeMax: number): BusyBlock[] {
  const data = ical.sync.parseICS(text);
  const blocks: BusyBlock[] = [];
  const push = (b: BusyBlock) => {
    if (b.end > timeMin && b.start < timeMax) blocks.push(b);
  };

  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    if (!ev.start) continue;
    const start = ev.start as Flagged;
    const end = (ev.end as Flagged | undefined) ?? undefined;
    const allDay = !!start.dateOnly;
    const durationMs = end ? end.getTime() - start.getTime() : allDay ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;

    if (!ev.rrule) {
      if (!blocksTime(ev)) continue;
      push(allDay ? allDayBlock(start, end) : { start: start.getTime(), end: start.getTime() + durationMs });
      continue;
    }

    // Repeating: expand the occurrences in the window, honoring deleted
    // (EXDATE) and moved/changed (RECURRENCE-ID) instances.
    const exdates = new Set(Object.values(ev.exdate ?? {}).map((d) => new Date(d as Date).getTime()));
    const overrides = new Map<number, VEvent>();
    for (const r of Object.values(ev.recurrences ?? {})) {
      const rid = (r as VEvent & { recurrenceid?: Date }).recurrenceid;
      if (rid) overrides.set(new Date(rid).getTime(), r as VEvent);
    }
    const occurrences = ev.rrule.between(new Date(timeMin - durationMs - 24 * 60 * 60 * 1000), new Date(timeMax + 24 * 60 * 60 * 1000), true);
    for (const occ of occurrences) {
      const t = occ.getTime();
      if (exdates.has(t)) continue;
      const moved = overrides.get(t);
      if (moved) continue; // handled below with its own times
      if (!blocksTime(ev)) continue;
      push(allDay ? allDayBlock(occ as Flagged, new Date(t + durationMs) as Flagged) : { start: t, end: t + durationMs });
    }
    for (const moved of overrides.values()) {
      if (!moved.start || !blocksTime(moved)) continue;
      const ms = moved.start as Flagged;
      const me = moved.end as Flagged | undefined;
      push(ms.dateOnly ? allDayBlock(ms, me) : { start: ms.getTime(), end: me ? me.getTime() : ms.getTime() + durationMs });
    }
  }
  return blocks;
}

// Busy blocks between timeMin and timeMax. Never throws: if the link is
// broken it's reported (the booking page could otherwise offer a time
// she's busy in Outlook) and Google busy times still apply.
export async function listOutlookBusy(timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  try {
    const text = await fetchIcs();
    if (!text) return [];
    return busyBlocksFromIcs(text, new Date(timeMin).getTime(), new Date(timeMax).getTime());
  } catch (err) {
    await reportFailure("Couldn't read your Outlook calendar (booking times may show you as free when you're busy in Outlook)", err);
    return [];
  }
}
