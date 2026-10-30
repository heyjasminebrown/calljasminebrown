"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useSectionOpen } from "@/lib/hooks/useSectionOpen";

// Shared collapsible card - every card on the contact detail page (and,
// later, Today) uses this instead of six copy-pasted toggle blocks. State
// persists across navigation via useSectionOpen, keyed by `sectionKey`.
export function Section({
  sectionKey,
  title,
  meta,
  action,
  defaultOpen = true,
  forceOpen,
  children,
}: {
  sectionKey: string;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useSectionOpen(sectionKey, defaultOpen, forceOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#eadfd6] bg-[#fffbf8] shadow-card">
      <div className="flex w-full items-center gap-2.5 px-[18px] py-4">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className="text-base font-semibold text-neutral-900">{title}</span>
          {meta && <span className="text-[15px] text-neutral-500">{meta}</span>}
        </button>
        {action}
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-neutral-400">
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </button>
      </div>
      {open && <div className="border-t border-neutral-100">{children}</div>}
    </div>
  );
}
