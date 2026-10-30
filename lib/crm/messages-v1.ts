import { formatLocal } from "@/lib/format-time";
import { displayFullName, formatPhone } from "@/lib/utils";
import type { Activity } from "@/types/database";

type SmsConversationSource = {
  contact: {
    id: string;
    first_name: string;
    last_name?: string | null;
    phone: string | null;
    representing?: "buyer" | "seller" | "both" | null;
    pipeline_stages?: { name: string | null } | null;
  };
  lastSms: Activity | null;
  lastInboundSmsAt: string | null;
  smsNeedsReply: boolean;
  recentInboundSmsAt: string[];
};

export const MESSAGES_CREAM = "#F7F1E8";
export const MESSAGES_TERRACOTTA = "#C45C3E";

export type MessagesFilter = "needs" | "unread" | "all";

export type SmsInboxThread = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  stageName: string | null;
  representing: "buyer" | "seller" | "both" | null;
  preview: string;
  occurredAt: string;
  lastInboundAt: string | null;
  needsReply: boolean;
  recentInboundAt: string[];
};

export type SmsThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  occurredAt: string;
};

export type OpenSmsThread = {
  contactId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  stageName: string | null;
  representing: "buyer" | "seller" | "both" | null;
  messages: SmsThreadMessage[];
  draft?: string;
};

export function parseMessagesFilter(raw: string | undefined | null): MessagesFilter {
  if (raw === "unread") return "unread";
  if (raw === "all") return "all";
  return "needs";
}

// Needs reply = last SMS inbound with no outbound since. Calls are ignored.
export function smsNeedsReply(activitiesNewestFirst: Pick<Activity, "type" | "direction">[]): boolean {
  for (const activity of activitiesNewestFirst) {
    if (activity.type !== "text") continue;
    return activity.direction === "inbound";
  }
  return false;
}

export function lastSms(activitiesNewestFirst: Activity[]): Activity | null {
  return activitiesNewestFirst.find((activity) => activity.type === "text") ?? null;
}

export function inboundSmsTimes(activitiesNewestFirst: Pick<Activity, "type" | "direction" | "occurred_at">[]): string[] {
  return activitiesNewestFirst.filter((activity) => activity.type === "text" && activity.direction === "inbound").map((activity) => activity.occurred_at);
}

export function isSmsUnread(lastInboundAt: string | null | undefined, lastSeenAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false;
  if (!lastSeenAt) return true;
  return Date.parse(lastInboundAt) > Date.parse(lastSeenAt);
}

export function unseenInboundCount(inboundAt: string[], lastSeenAt: string | null | undefined): number {
  if (inboundAt.length === 0) return 0;
  if (!lastSeenAt) return inboundAt.length;
  const seen = Date.parse(lastSeenAt);
  return inboundAt.filter((iso) => Date.parse(iso) > seen).length;
}

export function toSmsInboxThreads(conversations: SmsConversationSource[]): SmsInboxThread[] {
  return conversations
    .filter((conversation) => conversation.lastSms)
    .map((conversation) => {
      const last = conversation.lastSms!;
      return {
        id: conversation.contact.id,
        firstName: conversation.contact.first_name,
        lastName: conversation.contact.last_name ?? "",
        phone: conversation.contact.phone,
        stageName: conversation.contact.pipeline_stages?.name ?? null,
        representing: conversation.contact.representing ?? null,
        preview: (last.body ?? "").replace(/\s+/g, " ").trim() || "SMS",
        occurredAt: last.occurred_at,
        lastInboundAt: conversation.lastInboundSmsAt,
        needsReply: conversation.smsNeedsReply,
        recentInboundAt: conversation.recentInboundSmsAt,
      };
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

export function filterSmsInboxThreads(
  threads: SmsInboxThread[],
  filter: MessagesFilter,
  seen: Record<string, string>,
  query: string,
): SmsInboxThread[] {
  const needle = query.trim().toLowerCase();
  return threads.filter((thread) => {
    if (filter === "needs" && !thread.needsReply) return false;
    if (filter === "unread" && !isSmsUnread(thread.lastInboundAt, seen[thread.id])) return false;
    if (!needle) return true;
    const haystack = `${thread.firstName} ${thread.lastName} ${thread.phone ?? ""} ${thread.preview}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export function threadDisplayName(thread: Pick<SmsInboxThread, "firstName" | "lastName">): string {
  return displayFullName({ first_name: thread.firstName, last_name: thread.lastName });
}

export function formatInboxPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const formatted = formatPhone(phone);
  return formatted.startsWith("+") ? formatted : formatted;
}

export function inboxDayKey(iso: string | Date): string {
  return formatLocal(iso, "yyyy-MM-dd");
}

export function inboxRelativeTime(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (inboxDayKey(iso) === inboxDayKey(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatLocal(iso, "MMM d");
}
