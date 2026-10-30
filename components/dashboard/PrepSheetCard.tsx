"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";
import { clearPinnedItem } from "@/app/(app)/today-actions";
import { openQuoCall } from "@/lib/quo/call-link";
import { initials, formatCurrency, formatPercent } from "@/lib/utils";
import { ActivityTimeline } from "@/components/contacts/ActivityTimeline";
import type { PrepSheetPayload } from "@/lib/data/prep-sheet";

export function PrepSheetCard({ id, payload }: { id: string; payload: PrepSheetPayload }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const time = new Date(payload.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const [firstName, ...lastParts] = payload.contactName.split(" ");

  async function handleClear() {
    setClearing(true);
    await clearPinnedItem(id);
    router.refresh();
  }

  const dontForget = [
    ...payload.openTasks.map((t) => (t.dueAt ? `You promised to ${t.title.replace(/^to /i, "")}. Still open.` : `You promised: ${t.title}. Still open.`)),
    payload.lastQuote
      ? `You quoted them ${formatCurrency(payload.lastQuote.monthlyOutOfPocket)} a month on ${payload.lastQuote.address} at ${formatPercent(payload.lastQuote.ratePct, 3)}.`
      : null,
  ].filter((v): v is string => !!v);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <div className="flex items-center gap-2.5 bg-[#1c1917] px-[18px] py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[#eea095]">Notification · 30 minutes out</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {payload.eventTitle} with {payload.contactName} at {time}
            {payload.location ? ` — ${payload.location}` : ""}
          </p>
        </div>
        <button type="button" onClick={handleClear} disabled={clearing} className="shrink-0 text-sm font-medium text-neutral-300 disabled:opacity-50">
          {clearing ? "Clearing…" : "Clear"}
        </button>
      </div>

      <div className="space-y-5 p-[18px]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-semibold text-neutral-600">
            {initials(firstName, lastParts.join(" "))}
          </div>
          <p className="min-w-0 flex-1 truncate font-serif text-[26px] font-semibold leading-8 text-neutral-900">{payload.contactName}</p>
          {payload.contactPhone && (
            <button
              type="button"
              onClick={() => openQuoCall(payload.contactPhone!)}
              className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800"
            >
              <Phone size={15} /> Call {firstName}
            </button>
          )}
        </div>

        {payload.sinceLastSpoke && (
          <div className="rounded-xl border border-[#ebe9e7] bg-[#fcfbfa] p-5">
            <p className="text-[17px] font-semibold text-neutral-900">Since you last spoke</p>
            <p className="mt-2 text-[16px] leading-[25px] text-neutral-700">{payload.sinceLastSpoke}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {payload.whatTheyreAfter.length > 0 && (
            <div className="rounded-xl border border-[#ebe9e7] p-3.5">
              <p className="text-sm font-semibold text-neutral-500">What they&apos;re after</p>
              <div className="mt-2 space-y-1.5">
                {payload.whatTheyreAfter.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2 text-[15px]">
                    <span className="text-neutral-600">{r.label}</span>
                    <span className="font-semibold text-neutral-900">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dontForget.length > 0 && (
            <div className="rounded-xl border border-[#ebe9e7] p-3.5">
              <p className="text-sm font-semibold text-neutral-500">Don&apos;t forget</p>
              <div className="mt-2 space-y-2.5">
                {dontForget.map((line, i) => (
                  <p key={i} className="text-[16px] leading-6 text-neutral-700">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {payload.worthAsking.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#ebe9e7]">
            <button
              type="button"
              onClick={() => setQuestionsOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-[18px] py-3.5 text-left text-[17px] font-semibold text-neutral-900"
            >
              Worth asking today
              <span className="text-sm font-medium text-neutral-400">{questionsOpen ? "Hide" : "Show"}</span>
            </button>
            {questionsOpen && (
              <div className="border-t border-neutral-100 px-[18px] py-3.5">
                <div className="space-y-2">
                  {payload.worthAsking.map((q, i) => (
                    <p key={i} className="text-[16px] leading-6 text-neutral-700">
                      {q}
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-[15px] leading-[22px] text-neutral-500">
                  Three questions, drawn from what&apos;s missing or stale on their record. Ignore them freely.
                </p>
              </div>
            )}
          </div>
        )}

        {payload.notes && (
          <div>
            <p className="text-sm font-semibold text-neutral-500">Notes on file</p>
            <p className="mt-1 text-[15px] leading-6 text-neutral-700">{payload.notes}</p>
          </div>
        )}

        {payload.recentActivity.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#ebe9e7]">
            <button
              type="button"
              onClick={() => setTimelineOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-[18px] py-3.5 text-left text-[17px] font-semibold text-neutral-900"
            >
              Everything, in order
              <span className="text-sm font-medium text-neutral-400">
                {payload.totalActivityCount} entr{payload.totalActivityCount === 1 ? "y" : "ies"}
                {payload.firstActivityAt ? ` since ${new Date(payload.firstActivityAt).toLocaleDateString("en-US", { month: "long" })}` : ""}
              </span>
            </button>
            {timelineOpen && (
              <div className="border-t border-neutral-100">
                <ActivityTimeline activities={payload.timelineActivities} />
              </div>
            )}
          </div>
        )}

        <div className="border-t border-neutral-100 pt-4">
          <Link href={`/contacts/${payload.contactId}`} className="text-sm font-semibold text-brand-700">
            Open full record
          </Link>
        </div>
      </div>
    </div>
  );
}
