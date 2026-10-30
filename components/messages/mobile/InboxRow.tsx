"use client";

import Link from "next/link";
import { Phone, StickyNote, EyeOff, PhoneMissed, CircleCheck } from "lucide-react";
import { Avatar } from "@/components/ui";
import { SwipeActions } from "@/components/mobile/SwipeActions";
import { LogSheet } from "@/components/contacts/mobile/LogSheet";
import { openQuoCall } from "@/lib/quo/call-link";
import { isMissedCall } from "@/lib/crm/message-owed";
import { threadHref } from "@/lib/crm/inbox-href";
import { formatShortRelative } from "@/lib/format-time";
import { dismissReplyOwed } from "@/app/(app)/today-actions";
import { fullName, cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/lib/data/messages";

const REPRESENTING_LABEL: Record<string, string> = { buyer: "buyer", seller: "seller", both: "buyer & seller" };

export function InboxRow({
  conversation,
  ownerId,
  openRowId,
  onOpenChange,
  filter,
}: {
  conversation: Conversation;
  ownerId: string;
  openRowId: string | null;
  onOpenChange: (id: string | null) => void;
  filter?: string | null;
}) {
  const router = useRouter();
  const { contact, lastActivity, owed, owedActivity } = conversation;
  const displayActivity = owed && owedActivity ? owedActivity : lastActivity;
  const missedCall = isMissedCall(displayActivity);
  const [logOpen, setLogOpen] = useState(false);

  // Whether Quo actually attached a recording, not just "was this call
  // missed" - a missed call whose status happens to be "voicemail" means
  // one was left, and saying "no voicemail" on it was flatly wrong.
  const hasVoicemail = typeof displayActivity.metadata?.recording_url === "string" && !!displayActivity.metadata.recording_url;

  let preview = displayActivity.body ?? (displayActivity.type === "call" ? "Call" : "");
  if (missedCall) preview = hasVoicemail ? "Missed call · left a voicemail" : "Missed call · no voicemail";
  else if (displayActivity.type === "text" && displayActivity.direction === "outbound") preview = `You: ${preview}`;

  const stage = contact.pipeline_stages;
  const contextLine = [stage?.name, contact.representing ? REPRESENTING_LABEL[contact.representing] : null].filter(Boolean).join(" · ");

  async function hide() {
    const supabase = createClient();
    await supabase.from("contacts").update({ archived: true }).eq("id", contact.id);
    router.refresh();
  }

  async function dismiss() {
    const activityId = owedActivity?.id ?? lastActivity.id;
    await dismissReplyOwed(activityId);
    router.refresh();
  }

  const actions = [
    ...(owed
      ? [{ icon: CircleCheck, label: "Done", bg: "#292524", onClick: dismiss }]
      : [{ icon: StickyNote, label: "Log", bg: "#292524", onClick: () => setLogOpen(true) }]),
    ...(contact.phone ? [{ icon: Phone, label: "Call", bg: "#e7e5e4", onClick: () => openQuoCall(contact.phone!) }] : []),
    { icon: EyeOff, label: "Hide", bg: "#ac3826", onClick: hide },
  ];

  return (
    <SwipeActions rowId={contact.id} openRowId={openRowId} onOpenChange={onOpenChange} actions={actions}>
      <Link href={threadHref(contact.id, { filter })} className={cn("flex items-center gap-3 px-4 py-3", owed ? "bg-white" : "bg-[#fcfbfa]")}>
        <Avatar firstName={contact.first_name} lastName={contact.last_name} size={46} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[17px] font-semibold text-neutral-900">{fullName(contact)}</span>
            <span className="shrink-0 text-[13px] font-medium text-neutral-400">{formatShortRelative(displayActivity.occurred_at)}</span>
          </p>
          <p className={cn("mt-0.5 truncate text-[15px]", missedCall ? "flex items-center gap-1 font-semibold text-[#b91c1c]" : owed ? "text-neutral-700" : "text-neutral-500")}>
            {missedCall && <PhoneMissed size={13} className="shrink-0" />}
            {preview || "—"}
          </p>
          {owed && contextLine && <p className="mt-0.5 truncate text-[13px] text-neutral-400">{contextLine}</p>}
        </div>
      </Link>
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} ownerId={ownerId} contactId={contact.id} contactName={fullName(contact)} />
    </SwipeActions>
  );
}
