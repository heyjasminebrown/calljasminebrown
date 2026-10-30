"use client";

import Link from "next/link";
import {
  inboxRelativeTime,
  isSmsUnread,
  threadDisplayName,
  unseenInboundCount,
  MESSAGES_CREAM,
  MESSAGES_TERRACOTTA,
  type SmsInboxThread,
} from "@/lib/crm/messages-v1";
import { cn } from "@/lib/utils";

function InboxAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
      style={{ backgroundColor: MESSAGES_TERRACOTTA }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function InboxThreadRow({
  thread,
  href,
  selected,
  lastSeenAt,
  layout,
}: {
  thread: SmsInboxThread;
  href: string;
  selected: boolean;
  lastSeenAt?: string;
  layout: "desktop" | "mobile";
}) {
  const unreadCount = unseenInboundCount(thread.recentInboundAt, lastSeenAt);
  const unread = isSmsUnread(thread.lastInboundAt, lastSeenAt);
  const name = threadDisplayName(thread);

  if (layout === "mobile") {
    return (
      <Link href={href} className="flex items-start gap-3 px-4 py-3.5">
        <InboxAvatar name={thread.firstName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[16px] font-semibold text-neutral-900">{name}</p>
            <p className="shrink-0 text-[13px] text-neutral-400">{inboxRelativeTime(thread.occurredAt)}</p>
          </div>
          <div className="mt-0.5 flex items-start justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 text-neutral-500">{thread.preview}</p>
            {unread && unreadCount > 0 && (
              <span
                className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: MESSAGES_TERRACOTTA }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          {thread.needsReply && (
            <span className="mt-2 inline-flex rounded-full border border-[#eadfd6] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#C45C3E]">
              Needs reply
            </span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn("flex items-start gap-3 px-4 py-3.5", selected && "rounded-[14px]")}
      style={selected ? { backgroundColor: MESSAGES_CREAM } : undefined}
    >
      <InboxAvatar name={thread.firstName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-neutral-900">{name}</p>
            {unread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: MESSAGES_TERRACOTTA }} />}
          </div>
          <p className="shrink-0 text-[13px] text-neutral-400">{inboxRelativeTime(thread.occurredAt)}</p>
        </div>
        {thread.needsReply && (
          <span className="mt-1 inline-flex rounded-full border border-[#eadfd6] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[#C45C3E]">
            Needs reply
          </span>
        )}
        <p className="mt-1 truncate text-[14px] leading-5 text-neutral-500">{thread.preview}</p>
      </div>
    </Link>
  );
}
