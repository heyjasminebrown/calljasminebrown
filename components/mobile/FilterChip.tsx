"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterChip({
  label,
  selected,
  onToggle,
  className,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex h-[45px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-[15px] text-[15px] font-medium",
        selected ? "bg-brand-600 font-semibold text-white" : "border border-neutral-200 text-neutral-700",
        className,
      )}
    >
      {selected && <Check size={15} />}
      {label}
    </button>
  );
}
