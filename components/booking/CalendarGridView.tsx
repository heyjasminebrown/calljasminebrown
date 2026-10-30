"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";
import type { Slot } from "@/lib/crm/booking-availability";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dayKey(iso: string): string {
  return formatInTimeZone(iso, APP_TIMEZONE, "yyyy-MM-dd");
}

export function CalendarGridView({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (startAt: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = dayKey(slot.startAt);
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots]);

  const dayKeys = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const [viewMonth, setViewMonth] = useState(() => {
    const first = dayKeys[0] ?? todayKey;
    const [y, m] = first.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(selected ? dayKey(selected) : (dayKeys[0] ?? null));

  const minMonthKey = (dayKeys[0] ?? todayKey).slice(0, 7);
  const maxMonthKey = (dayKeys[dayKeys.length - 1] ?? todayKey).slice(0, 7);
  const viewMonthKey = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;

  const gridStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startOffset = gridStart.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }),
  ];

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="bk-when">
      <div className="bk-cal">
        <div className="bk-month">
          <button type="button" onClick={() => changeMonth(-1)} disabled={viewMonthKey <= minMonthKey} aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <b>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</b>
          <button type="button" onClick={() => changeMonth(1)} disabled={viewMonthKey >= maxMonthKey} aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="bk-days">
          {WEEKDAY_HEADERS.map((d, i) => (
            <span key={i} className="dw">
              {d}
            </span>
          ))}
          {cells.map((key, i) => {
            if (!key) return <span key={i} />;
            const hasSlots = byDay.has(key);
            const isSelected = key === selectedDay;
            const isToday = key === todayKey;
            return (
              <button
                key={i}
                type="button"
                disabled={!hasSlots}
                onClick={() => setSelectedDay(key)}
                className={`${hasSlots ? "av" : ""} ${isSelected ? "sel" : ""} ${isToday ? "today" : ""}`}
              >
                {Number(key.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bk-slots">
        {!selectedDay || !byDay.has(selectedDay) ? (
          <p className="bk-empty">Pick a highlighted day to see times.</p>
        ) : (
          <>
            <p className="bk-daylabel">{formatInTimeZone(`${selectedDay}T12:00:00`, APP_TIMEZONE, "EEEE, MMM d")}</p>
            <div className="bk-times">
              {byDay.get(selectedDay)!.map((slot) => (
                <button key={slot.startAt} type="button" onClick={() => onSelect(slot.startAt)} className={selected === slot.startAt ? "sel" : ""}>
                  {formatInTimeZone(slot.startAt, APP_TIMEZONE, "h:mm a")}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
