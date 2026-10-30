"use client";

import { SNOOZE_OPTIONS } from "@/lib/crm/snooze";

export function SnoozeMenu({
  onPick,
  align = "right",
}: {
  onPick: (days: number) => void;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`absolute top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg ${align === "left" ? "left-0" : "right-0"}`}
    >
      {SNOOZE_OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => onPick(option.days)}
          className="block w-full px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
