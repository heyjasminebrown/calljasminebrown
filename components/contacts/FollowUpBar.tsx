"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Bell } from "lucide-react";
import { clearFollowUp, snoozeFollowUp } from "@/app/(app)/today-actions";
import { formatLocal, isTodayLocal, isFollowUpOverdue } from "@/lib/format-time";
import { SnoozeMenu } from "@/components/contacts/SnoozeMenu";
import { useToast } from "@/lib/hooks/useToast";
import { Toast } from "@/components/mobile/Toast";

function followUpLabel(iso: string): string {
  const day = formatLocal(iso, "EEE MMM d");
  const time = formatLocal(iso, "h:mm a");
  if (isTodayLocal(iso)) return `Today ${time}`;
  return `${day}`;
}

export function FollowUpBar({ contactId, nextFollowUpAt }: { contactId: string; nextFollowUpAt: string | null }) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!nextFollowUpAt) return null;

  const overdue = isFollowUpOverdue(nextFollowUpAt);

  async function complete() {
    setBusy(true);
    const res = await clearFollowUp(contactId);
    setBusy(false);
    if (!res.ok) showToast("Couldn't complete that", "error");
    else router.refresh();
  }

  async function snooze(days: number) {
    setSnoozeOpen(false);
    setBusy(true);
    const res = await snoozeFollowUp(contactId, days);
    setBusy(false);
    if (!res.ok) showToast("Couldn't snooze that", "error");
    else router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] px-3.5 py-3 shadow-card">
      <Calendar size={18} className={overdue ? "text-[#b91c1c]" : "text-brand-700"} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-neutral-400">Next follow-up</p>
        <p className={`truncate text-[15px] font-semibold ${overdue ? "text-[#b91c1c]" : "text-neutral-900"}`}>
          {overdue ? `Was due ${formatLocal(nextFollowUpAt, "MMM d")}` : followUpLabel(nextFollowUpAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={complete}
        disabled={busy}
        className="flex h-9 items-center gap-1 rounded-full border border-neutral-200 px-3 text-[13px] font-semibold text-neutral-800 disabled:opacity-50"
      >
        <Check size={14} /> Complete
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setSnoozeOpen((v) => !v)}
          disabled={busy}
          className="flex h-9 items-center gap-1 rounded-full border border-neutral-200 px-3 text-[13px] font-semibold text-neutral-800 disabled:opacity-50"
        >
          <Bell size={14} /> Snooze
        </button>
        {snoozeOpen && <SnoozeMenu onPick={snooze} />}
      </div>
      <Toast toast={toast} />
    </div>
  );
}
