"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Phone, MessageSquareText } from "lucide-react";
import { openQuoCall, openQuoText } from "@/lib/quo/call-link";
import { relativeTime } from "@/lib/format-time";
import { initials, cn } from "@/lib/utils";
import type { WarmContact } from "@/lib/data/warm";

const TIER_LABEL: Record<WarmContact["tier"], string> = { very_warm: "very warm", warm: "warm", reading: "reading", steady: "steady" };
const TIER_BAR: Record<WarmContact["tier"], string> = {
  very_warm: "bg-brand-600",
  warm: "bg-neutral-500",
  reading: "bg-neutral-500",
  steady: "bg-neutral-300",
};

export function WarmRow({ contact, defaultOpen = false }: { contact: WarmContact; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const pct = Math.max(8, Math.min(100, Math.round((contact.deviation / 5) * 100)));
  const lastEvent = contact.events[0];

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] font-semibold text-neutral-600">
          {initials(contact.name.split(" ")[0] ?? "", contact.name.split(" ").slice(1).join(" "))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-6 text-neutral-900">{contact.name}</p>
          <p className="truncate text-[15px] leading-[22px] text-neutral-600">
            {contact.signalsThisWeek} signal{contact.signalsThisWeek === 1 ? "" : "s"} this week
            {lastEvent ? ` · last ${relativeTime(lastEvent.date)}` : ""}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-[120px] overflow-hidden rounded-full bg-neutral-100">
              <div className={cn("h-full rounded-full", TIER_BAR[contact.tier])} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-neutral-500">{TIER_LABEL[contact.tier]}</span>
          </div>
        </div>
        <span className="shrink-0 text-neutral-400">{open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
      </button>

      {open && (
        <div className="bg-[#fcfbfa] px-4 pb-4">
          {contact.events.length > 0 && (
            <div className="mb-3 space-y-1.5 rounded-xl border border-neutral-200 bg-white p-3.5">
              {contact.events.slice(0, 8).map((e, i) => (
                <p key={i} className="flex items-baseline gap-2 text-[15px] text-neutral-700">
                  <span className="w-24 shrink-0 text-sm text-neutral-400">{relativeTime(e.date)}</span>
                  {e.label}
                </p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {contact.phone && (
              <button
                type="button"
                onClick={() => openQuoCall(contact.phone!)}
                className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800"
              >
                <Phone size={15} className="text-neutral-500" /> Call
              </button>
            )}
            {contact.phone && (
              <button
                type="button"
                onClick={() => openQuoText(contact.phone!)}
                className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800"
              >
                <MessageSquareText size={15} className="text-neutral-500" /> Text
              </button>
            )}
            <Link href={`/contacts/${contact.contactId}`} className="text-sm font-semibold text-neutral-500">
              Open contact
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
