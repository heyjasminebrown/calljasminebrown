"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { PhoneOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { markNotSpam, archiveSpam } from "@/app/(app)/messages/spam-actions";
import { formatPhone } from "@/lib/utils";
import type { Conversation } from "@/lib/data/messages";

// Desktop's row for the Spam bucket - a variant of ConversationRow's quiet
// styling, not the same component: no Reply/Call actions (there's nothing
// to reply to), a phone-off glyph instead of initials, and the detected
// reason as a pill instead of a stage/representing line.
export function SpamRow({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const { contact, lastActivity } = conversation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reason =
    typeof lastActivity.metadata?.spam_reason === "string"
      ? lastActivity.metadata.spam_reason
      : contact.spam
        ? null
        : "Unknown number · missed call";
  const preview = lastActivity.body ?? "Call";

  async function handleNotSpam() {
    setBusy(true);
    setError("");
    const result = await markNotSpam(contact.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    setError("");
    const result = await archiveSpam(contact.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[#f0efee] bg-[#fcfbfa] px-4 py-[15px]">
      <div className="flex items-center gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0efee] text-neutral-400">
          <PhoneOff size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2.5 text-[17px] font-semibold leading-6 text-neutral-900">
            <span className="truncate">{formatPhone(contact.phone) || "Unknown number"}</span>
            <span className="shrink-0 text-sm font-medium text-neutral-500">
              {formatDistanceToNow(new Date(lastActivity.occurred_at), { addSuffix: true })}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[15px] leading-[22px] text-neutral-600">{preview}</p>
          {reason && <span className="mt-1 inline-block w-fit rounded-full bg-neutral-100 px-2.5 py-0.5 text-[13px] font-medium text-neutral-600">{reason}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleNotSpam}
            disabled={busy}
            className="whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
          >
            Not spam
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            aria-label="Delete"
            className="rounded-[10px] border border-neutral-200 bg-white p-2.5 text-brand-600 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
