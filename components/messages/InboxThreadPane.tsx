"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { markInboxThreadSeen } from "@/app/(app)/messages/seen-actions";
import { InboxBubbles } from "@/components/messages/InboxBubbles";
import { InboxComposer } from "@/components/messages/InboxComposer";
import { ScrollToBottomOnLoad } from "@/components/messages/ScrollToBottomOnLoad";
import { openQuoCall } from "@/lib/quo/call-link";
import { formatInboxPhone, threadDisplayName, MESSAGES_TERRACOTTA, type OpenSmsThread } from "@/lib/crm/messages-v1";
import { REPRESENTING_LABELS } from "@/lib/utils";

function StageChips({ stageName, representing }: { stageName: string | null; representing: OpenSmsThread["representing"] }) {
  const chips = [
    representing ? REPRESENTING_LABELS[representing] : null,
    stageName,
  ].filter((chip): chip is string => !!chip);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full bg-[#EEF1F4] px-2.5 py-1 text-[12px] font-medium text-neutral-600">
          {chip}
        </span>
      ))}
    </div>
  );
}

function ThreadActions({ phone, contactId }: { phone: string | null; contactId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-4">
      {phone && (
        <button
          type="button"
          onClick={() => openQuoCall(phone)}
          className="inline-flex items-center gap-1.5 text-[14px] font-medium"
          style={{ color: MESSAGES_TERRACOTTA }}
        >
          <Phone size={16} />
          Call
        </button>
      )}
      <Link
        href={`/contacts/${contactId}`}
        data-contact-open={contactId}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium"
        style={{ color: MESSAGES_TERRACOTTA }}
      >
        <ExternalLink size={16} />
        Open contact
      </Link>
    </div>
  );
}

export function InboxThreadPane({
  thread,
  unread,
  backHref,
  layout,
}: {
  thread: OpenSmsThread;
  unread: boolean;
  backHref: string;
  layout: "desktop" | "mobile";
}) {
  useEffect(() => {
    void markInboxThreadSeen(thread.contactId);
  }, [thread.contactId]);

  const name = threadDisplayName(thread);
  const phoneLabel = formatInboxPhone(thread.phone);

  if (layout === "mobile") {
    return (
      <div className="flex min-h-dvh flex-col bg-[#F7F1E8]">
        <div className="sticky top-0 z-10 border-b border-[#eadfd6] bg-[#F7F1E8]/95 px-3 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link href={backHref} className="inline-flex items-center gap-1 text-[15px] font-medium text-[#C45C3E]">
              <ArrowLeft size={18} />
              Messages
            </Link>
            <ThreadActions phone={thread.phone} contactId={thread.contactId} />
          </div>
          <p className="mt-2 truncate text-[18px] font-semibold text-neutral-900">{name}</p>
          {phoneLabel && <p className="mt-0.5 truncate text-[13px] text-neutral-400">{phoneLabel}</p>}
          <div className="mt-2">
            <StageChips stageName={thread.stageName} representing={thread.representing} />
          </div>
        </div>
        <div className="flex-1 px-4 py-5 pb-36">
          <InboxBubbles messages={thread.messages} />
          <ScrollToBottomOnLoad token={thread.messages.at(-1)?.id} />
        </div>
        <InboxComposer
          contactId={thread.contactId}
          phone={thread.phone}
          firstName={thread.firstName}
          lastName={thread.lastName}
          initialBody={thread.draft}
          sticky
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-[#eadfd6] bg-white">
      <div className="shrink-0 border-b border-[#eadfd6] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
            style={{ backgroundColor: MESSAGES_TERRACOTTA }}
          >
            {(thread.firstName.trim()[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[16px] font-semibold text-neutral-900">{name}</p>
              {unread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: MESSAGES_TERRACOTTA }} />}
            </div>
            {phoneLabel && <p className="mt-0.5 text-[13px] text-neutral-400">{phoneLabel}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <StageChips stageName={thread.stageName} representing={thread.representing} />
              <ThreadActions phone={thread.phone} contactId={thread.contactId} />
            </div>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <InboxBubbles messages={thread.messages} />
        <ScrollToBottomOnLoad token={thread.messages.at(-1)?.id} />
      </div>
      <InboxComposer
        contactId={thread.contactId}
        phone={thread.phone}
        firstName={thread.firstName}
        lastName={thread.lastName}
        initialBody={thread.draft}
      />
    </div>
  );
}
