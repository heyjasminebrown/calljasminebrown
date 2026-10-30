"use client";

import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-[44px] flex-1 rounded-[12px] px-3 text-[15px] font-semibold",
            value === option.value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
