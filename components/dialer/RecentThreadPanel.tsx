"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { getRecentTextsForContact } from "@/app/(app)/dialer/actions";
import { CallSummaryCard } from "@/components/messages/CallSummaryCard";
import { relativeTime } from "@/lib/format-time";
import type { TextThreadMessage } from "@/lib/crm/recent-texts";

// The Dialer's conversation panel - last 10 texts and calls, oldest at
// top, scrolled to the newest on load. Open by default everywhere it's
// used (mobile inline in PersonCard, desktop as its own 340px rail) so
// she can see what was already said before adjusting the draft, instead
// of it starting hidden behind a toggle.
export function RecentThreadPanel({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<TextThreadMessage[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(null);
    getRecentTextsForContact(contactId).then(setItems);
  }, [contactId]);

  useEffect(() => {
    if (items && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items]);

  return (
    <div className="rounded-[16px] border border-neutral-100 bg-[#fafaf9] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Last 10 · calls and texts</span>
        <Link href={`/messages/${contactId}`} className="text-[13px] font-medium text-brand-600">
          Open full thread
        </Link>
      </div>
      <div ref={scrollRef} className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
        {items === null ? (
          <p className="px-1 text-xs text-neutral-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-1 text-xs text-neutral-400">No calls or texts with this person yet.</p>
        ) : (
          items.map((item, i) =>
            item.kind === "text" ? (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-[18px] ${
                  item.direction === "inbound" ? "mr-auto bg-neutral-100 text-neutral-800" : "ml-auto bg-brand-600 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{item.body}</p>
                <p className={`mt-1 text-[10px] ${item.direction === "inbound" ? "text-neutral-400" : "text-brand-100"}`}>{relativeTime(item.occurredAt)}</p>
              </div>
            ) : (
              <CallThreadEntry key={i} item={item} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function CallThreadEntry({ item }: { item: Extract<TextThreadMessage, { kind: "call" }> }) {
  const Icon = item.direction === "inbound" ? PhoneIncoming : item.direction === "outbound" ? PhoneOutgoing : Phone;
  return (
    <div className="flex flex-col items-center gap-2 py-1">
      <span className="flex max-w-full items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs text-neutral-600">
        <Icon size={13} className="shrink-0 text-neutral-400" />
        <span className="min-w-0 truncate">{item.label ?? "Call"}</span>
        <span className="shrink-0 text-neutral-400">· {relativeTime(item.occurredAt)}</span>
      </span>
      {item.summary ? (
        <CallSummaryCard bullets={item.summary.bullets.slice(0, 5)} nextSteps={item.summary.nextSteps} transcript={item.transcript} />
      ) : (
        <p className="w-full max-w-xs rounded-xl border border-neutral-100 bg-white p-2.5 text-center text-xs text-neutral-400">
          {item.transcript ? "Transcript available, no summary yet." : "No transcript for this call."}
        </p>
      )}
    </div>
  );
}
