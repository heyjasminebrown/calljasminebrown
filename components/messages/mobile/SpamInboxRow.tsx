"use client";

import { PhoneOff, RotateCcw, Trash2 } from "lucide-react";
import { SwipeActions } from "@/components/mobile/SwipeActions";
import { markNotSpam, archiveSpam } from "@/app/(app)/messages/spam-actions";
import { formatShortRelative } from "@/lib/format-time";
import { formatPhone } from "@/lib/utils";
import type { Conversation } from "@/lib/data/messages";

export function SpamInboxRow({
  conversation,
  openRowId,
  onOpenChange,
  onCleared,
}: {
  conversation: Conversation;
  openRowId: string | null;
  onOpenChange: (id: string | null) => void;
  onCleared: () => void;
}) {
  const { contact, lastActivity } = conversation;
  const reason =
    typeof lastActivity.metadata?.spam_reason === "string"
      ? lastActivity.metadata.spam_reason
      : contact.spam
        ? null
        : "Unknown number · missed call";

  const actions = [
    { icon: RotateCcw, label: "Not spam", bg: "#e7e5e4", onClick: async () => { await markNotSpam(contact.id); onCleared(); } },
    { icon: Trash2, label: "Delete", bg: "#ac3826", onClick: async () => { await archiveSpam(contact.id); onCleared(); } },
  ];

  return (
    <SwipeActions rowId={contact.id} openRowId={openRowId} onOpenChange={onOpenChange} actions={actions}>
      <div className="flex items-center gap-3 bg-[#fcfbfa] px-4 py-3">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#f0efee] text-neutral-400">
          <PhoneOff size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[17px] font-semibold text-neutral-900">{formatPhone(contact.phone) || "Unknown number"}</span>
            <span className="shrink-0 text-[13px] font-medium text-neutral-400">{formatShortRelative(lastActivity.occurred_at)}</span>
          </p>
          <p className="mt-0.5 truncate text-[15px] text-neutral-500">{reason ?? lastActivity.body ?? "Call"}</p>
        </div>
      </div>
    </SwipeActions>
  );
}
