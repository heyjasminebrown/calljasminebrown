"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Phone, MessageSquare } from "lucide-react";
import { cn, fullName } from "@/lib/utils";
import { openQuoCall } from "@/lib/quo/call-link";
import { isMissedCall } from "@/lib/crm/message-owed";
import { ConversationActions } from "@/components/messages/ConversationActions";
import { Avatar } from "@/components/ui";
import { threadHref } from "@/lib/crm/inbox-href";
import type { Conversation } from "@/lib/data/messages";

const REPRESENTING_LABEL: Record<string, string> = { buyer: "buyer", seller: "seller", both: "buyer & seller" };

export function ConversationRow({
  conversation,
  filter,
  hidden,
}: {
  conversation: Conversation;
  filter?: string | null;
  hidden?: boolean;
}) {
  const { contact, lastActivity, owed, owedActivity } = conversation;
  const displayActivity = owed && owedActivity ? owedActivity : lastActivity;
  const stage = contact.pipeline_stages;
  const missedCall = isMissedCall(displayActivity);

  // Whether Quo actually attached a recording, not just "was this call
  // missed" - a missed call whose status happens to be "voicemail" means
  // one was left, and saying "no voicemail" on it was flatly wrong.
  const hasVoicemail = typeof displayActivity.metadata?.recording_url === "string" && !!displayActivity.metadata.recording_url;

  let preview = displayActivity.body ?? (displayActivity.type === "call" ? "Call" : "");
  if (missedCall) {
    preview = hasVoicemail ? "Missed call · left a voicemail" : "Missed call · no voicemail";
  } else if (displayActivity.type === "call" && displayActivity.body) {
    preview = `Call · ${displayActivity.body.split(" · ")[0] ?? displayActivity.body}`;
  } else if (displayActivity.type === "text" && displayActivity.direction === "outbound") {
    preview = `You sent: ${preview}`;
  } else if (displayActivity.type === "text") {
    preview = `"${preview}"`;
  }

  const contextLine = [stage?.name, contact.representing ? REPRESENTING_LABEL[contact.representing] : null].filter(Boolean).join(" · ");

  function handleCallBack(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (contact.phone) openQuoCall(contact.phone);
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-4 py-[15px] sm:flex-row sm:items-center sm:gap-3.5",
        owed ? "border-[#ebe9e7] bg-white" : "border-[#f0efee] bg-[#fcfbfa]",
      )}
    >
      <Link href={threadHref(contact.id, { filter, hidden })} className="flex min-w-0 flex-1 items-center gap-3.5">
        <Avatar
          firstName={contact.first_name}
          lastName={contact.last_name}
          className={owed ? "bg-neutral-100 text-neutral-600" : "bg-[#f0efee] text-neutral-500"}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2.5 text-[17px] font-semibold leading-6 text-neutral-900">
            <span className="truncate">{fullName(contact)}</span>
            <span className="shrink-0 text-sm font-medium text-neutral-500">
              {formatDistanceToNow(new Date(displayActivity.occurred_at), { addSuffix: true })}
            </span>
          </p>
          <p className={cn("mt-0.5 truncate text-[15px] leading-[22px]", missedCall ? "font-semibold text-red-700" : owed ? "text-neutral-700" : "text-neutral-600")}>
            {preview || "—"}
          </p>
          {owed && contextLine && <p className="mt-0.5 truncate text-sm text-neutral-500">{contextLine}</p>}
        </div>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {owed &&
          (missedCall ? (
            <button
              type="button"
              onClick={handleCallBack}
              disabled={!contact.phone}
              className="inline-flex items-center gap-1.5 rounded-[10px] border-0 bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Phone size={15} /> Call back
            </button>
          ) : (
            <Link
              href={threadHref(contact.id, { filter, hidden })}
              className="inline-flex items-center gap-1.5 rounded-[10px] border-0 bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white"
            >
              <MessageSquare size={15} /> Reply
            </Link>
          ))}
        {owed && !missedCall && (
          <button
            type="button"
            onClick={handleCallBack}
            disabled={!contact.phone}
            className="inline-flex items-center rounded-[10px] border border-neutral-200 bg-white p-2.5 text-neutral-600 disabled:opacity-40"
          >
            <Phone size={15} />
          </button>
        )}
        <ConversationActions
          contactId={contact.id}
          hidden={contact.archived}
          activityId={owedActivity?.id ?? lastActivity.id}
          owed={owed}
          missedCall={missedCall}
        />
      </div>
    </div>
  );
}
