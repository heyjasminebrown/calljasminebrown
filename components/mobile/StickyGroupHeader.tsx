"use client";

import { ChevronDown } from "lucide-react";
import { useSectionOpen } from "@/lib/hooks/useSectionOpen";
import { cn } from "@/lib/utils";

// Replaces Section accordions in list contexts (Pipeline, People-by-stage).
// Where it's a direct replacement for an existing Section, pass
// sectionKey/defaultOpen so persisted open/closed state (useSectionOpen,
// shared localStorage key) carries over losslessly. Where there was never
// a Section to begin with (Inbox's "Waiting on you"/"Nothing owed"),
// render it non-collapsible - a plain sticky label.
export function StickyGroupHeader({
  label,
  count,
  summary,
  summaryTone = "default",
  collapsible,
  sectionKey,
  defaultOpen = true,
  children,
}: {
  label: string;
  count?: number;
  summary?: string;
  summaryTone?: "default" | "danger";
  collapsible?: boolean;
  sectionKey?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useSectionOpen(sectionKey ?? label, defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
    <div>
      <button
        type="button"
        onClick={collapsible ? () => setOpen(!open) : undefined}
        className={cn(
          "sticky top-0 z-10 flex w-full items-center justify-between gap-2 border-y border-[#ebe9e7] bg-neutral-100 px-4 py-[7px]",
          !collapsible && "cursor-default",
        )}
      >
        <span className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.05em] text-neutral-700">
          {label}
          {count !== undefined && <span className="font-normal normal-case tracking-normal text-neutral-400">{count}</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {summary && (
            <span className={cn("text-[13px] font-semibold", summaryTone === "danger" ? "text-[#b91c1c]" : "text-neutral-700")}>{summary}</span>
          )}
          {collapsible && <ChevronDown size={15} className={cn("text-neutral-400 transition-transform", isOpen && "rotate-180")} />}
        </span>
      </button>
      {isOpen && children}
    </div>
  );
}
