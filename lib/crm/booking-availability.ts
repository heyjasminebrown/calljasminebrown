import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { APP_TIMEZONE } from "@/lib/format-time";
import type { WeeklyHours, Weekday } from "@/types/database";

const WEEKDAY_KEYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type Slot = { startAt: string; endAt: string };

// Deterministic per-slot "looks busier" filter (her ask: hide some open
// time so the page doesn't read as wide open). Same slot always reads the
// same way to every visitor and across a reload, rather than flickering -
// this is purely a display choice, her real capacity (what's actually
// bookable if someone lands on the exact right time) is unaffected.
function slotVisible(ownerId: string, startAtIso: string, visiblePct: number): boolean {
  if (visiblePct >= 100) return true;
  let hash = 0;
  const key = `${ownerId}:${startAtIso}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash % 100 < visiblePct;
}

export type AvailabilitySettings = {
  durationMinutes: number;
  daysOut: number;
  visibleSlotPct: number;
  bufferMinutes: number;
  weeklyHours: WeeklyHours;
};

export type BusyInterval = { start: number; end: number };

export async function collectBusyIntervals(
  admin: SupabaseClient,
  ownerId: string,
  timeMin: string,
  timeMax: string,
  bufferMinutes: number,
  excludeRequestId?: string,
): Promise<BusyInterval[]> {
  const bufferMs = bufferMinutes * 60_000;
  const [events, { data: heldSlots }] = await Promise.all([
    listUpcomingEvents(admin, ownerId, timeMin, timeMax),
    admin
      .from("booking_requests")
      .select("id, starts_at, ends_at, proposed_starts_at, proposed_ends_at, stage")
      .eq("owner_id", ownerId)
      .in("stage", ["time_selected", "pending", "approved", "time_proposed"]),
  ]);

  const busy: BusyInterval[] = events.map((e) => ({
    start: new Date(e.startAt).getTime() - bufferMs,
    end: new Date(e.endAt).getTime() + bufferMs,
  }));
  for (const b of heldSlots ?? []) {
    if (excludeRequestId && b.id === excludeRequestId) continue;
    // A proposed-new-time request no longer occupies the original slot
    // (that time was released when she offered a different one) - hold
    // the proposed wall-clock instead, or two visitors can both land on
    // the time still sitting in the confirm-this-time? text.
    const start = b.stage === "time_proposed" ? b.proposed_starts_at : b.starts_at;
    const end = b.stage === "time_proposed" ? b.proposed_ends_at : b.ends_at;
    if (!start || !end) continue;
    busy.push({ start: new Date(start).getTime() - bufferMs, end: new Date(end).getTime() + bufferMs });
  }
  return busy;
}

export function intervalOverlapsBusy(startIso: string, endIso: string, busy: BusyInterval[]): boolean {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return busy.some((b) => start < b.end && end > b.start);
}

// Real Google Calendar busy time, plus any of her own in-progress or
// approved booking requests that already have a time attached (so two
// visitors can't both land on the same not-yet-synced-to-Google slot -
// this covers a session someone is mid-flow on right now too, not just
// ones that reached her review queue), subtracted from her configured
// weekly hours - then the visible_slot_pct filter is applied last, on
// top of what's genuinely open.
export async function computeAvailableSlots(admin: SupabaseClient, ownerId: string, settings: AvailabilitySettings): Promise<Slot[]> {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + settings.daysOut * 24 * 60 * 60 * 1000).toISOString();
  const busy = await collectBusyIntervals(admin, ownerId, timeMin, timeMax, settings.bufferMinutes);

  const durationMs = settings.durationMinutes * 60_000;
  const slots: Slot[] = [];
  const notBefore = new Date(now);
  notBefore.setMinutes(Math.ceil(notBefore.getMinutes() / 30) * 30, 0, 0);

  for (let dayOffset = 0; dayOffset <= settings.daysOut; dayOffset++) {
    // Her weekly_hours are wall-clock times in APP_TIMEZONE (Eastern), not
    // server-local time - a server running in UTC (Vercel) would otherwise
    // read "10:00" as 10:00 UTC (6am Eastern in summer), four-plus hours
    // off from what she actually configured. dayKey is computed the same
    // way (in Eastern) so the weekday lookup and the day-of-week itself
    // are consistent with her calendar, not the server's.
    const dayKey = formatInTimeZone(new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000), APP_TIMEZONE, "yyyy-MM-dd");
    const [y, m, d] = dayKey.split("-").map(Number);
    const hours = settings.weeklyHours[WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()]];
    if (!hours?.enabled) continue;

    const dayStart = fromZonedTime(`${dayKey} ${hours.start}:00`, APP_TIMEZONE).getTime();
    const dayEnd = fromZonedTime(`${dayKey} ${hours.end}:00`, APP_TIMEZONE).getTime();

    for (let t = dayStart; t + durationMs <= dayEnd; t += durationMs) {
      if (t < notBefore.getTime()) continue;
      const slotEnd = t + durationMs;
      if (busy.some((b) => t < b.end && slotEnd > b.start)) continue;

      const startIso = new Date(t).toISOString();
      if (!slotVisible(ownerId, startIso, settings.visibleSlotPct)) continue;

      slots.push({ startAt: startIso, endAt: new Date(slotEnd).toISOString() });
    }
  }

  return slots;
}
