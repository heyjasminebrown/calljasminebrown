"use client";

import { useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";
import type { Slot } from "@/lib/crm/booking-availability";

export function ListView({
  slots,
  selected,
  onSelect,
  variant: _variant = "crm",
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (startAt: string) => void;
  variant?: "crm" | "om";
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = formatInTimeZone(slot.startAt, APP_TIMEZONE, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots]);
  const dayKeys = [...groups.keys()].sort();

  if (dayKeys.length === 0) {
    return <p className="bk-empty">Nothing open right now — check back soon.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {dayKeys.map((key) => (
        <div key={key} className="bk-slots">
          <p className="bk-daylabel">{formatInTimeZone(`${key}T12:00:00`, APP_TIMEZONE, "EEEE, MMM d")}</p>
          <div className="bk-times">
            {groups.get(key)!.map((slot) => (
              <button key={slot.startAt} type="button" onClick={() => onSelect(slot.startAt)} className={selected === slot.startAt ? "sel" : ""}>
                {formatInTimeZone(slot.startAt, APP_TIMEZONE, "h:mm a")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
