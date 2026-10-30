"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { X, CalendarClock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { proposeNewTime, declineBooking } from "@/app/(app)/scheduling/actions";
import { APP_TIMEZONE } from "@/lib/format-time";

// Rounds to the next half-hour, one hour out - same "not a random minute
// in the near-present" reasoning as ScheduleMeetingModal's defaultStart.
function defaultProposedTime(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProposeNewTimeModal({ requestId, visitorName, onClose }: { requestId: string; visitorName: string; onClose: () => void }) {
  const router = useRouter();
  const [newTime, setNewTime] = useState(defaultProposedTime);
  const [sending, setSending] = useState<"propose" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function propose() {
    if (!newTime) return;
    setSending("propose");
    setError("");
    const result = await proposeNewTime(requestId, fromZonedTime(newTime, APP_TIMEZONE).toISOString());
    setSending(null);
    if (result.ok) {
      router.refresh();
      onClose();
    } else {
      setError(result.error);
    }
  }

  async function declineWithoutProposing() {
    setSending("decline");
    setError("");
    const result = await declineBooking(requestId);
    setSending(null);
    if (result.ok) {
      router.refresh();
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="font-serif text-xl font-semibold text-neutral-900">Propose a new time</p>
            <p className="mt-0.5 text-xs text-neutral-500">{visitorName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-500">New date &amp; time</label>
            <Input type="datetime-local" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </div>
          <p className="flex items-start gap-2 text-xs text-neutral-400">
            <CalendarClock size={14} className="mt-0.5 shrink-0" />
            Texts them right away asking if this works. Nothing&apos;s booked until they confirm - it&apos;ll show up as &quot;waiting on their
            confirmation&quot; until then.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={propose} disabled={sending !== null || !newTime} className="w-full">
            {sending === "propose" ? "Sending…" : "Send this time"}
          </Button>
          <button
            type="button"
            onClick={declineWithoutProposing}
            disabled={sending !== null}
            className="w-full text-center text-sm font-medium text-neutral-400 disabled:opacity-50"
          >
            {sending === "decline" ? "…" : "Decline without proposing a new time"}
          </button>
        </div>
      </div>
    </div>
  );
}
