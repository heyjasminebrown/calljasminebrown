"use client";

import { Phone } from "lucide-react";
import { openQuoCall } from "@/lib/quo/call-link";

export function WarmPreviewRow({
  name,
  phone,
  signalsThisWeek,
  lastEventLabel,
}: {
  name: string;
  phone: string | null;
  signalsThisWeek: number;
  lastEventLabel: string | null;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-neutral-100 px-[18px] py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-semibold leading-[23px] text-neutral-900">{name}</p>
        <p className="mt-0.5 text-[15px] text-neutral-600">
          {signalsThisWeek} signal{signalsThisWeek === 1 ? "" : "s"} this week{lastEventLabel ? ` · ${lastEventLabel}` : ""}
        </p>
      </div>
      {phone && (
        <button
          type="button"
          onClick={() => openQuoCall(phone)}
          className="shrink-0 rounded-[10px] border-0 bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white"
        >
          Call
        </button>
      )}
    </div>
  );
}
