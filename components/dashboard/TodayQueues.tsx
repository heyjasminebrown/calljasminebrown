import type { ReactNode } from "react";
import Link from "next/link";
import { Clock, Phone, UserPlus, Bell, ChevronRight, MessageCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayFocusHref } from "@/lib/crm/today-focus";
import { inboxHref } from "@/lib/crm/inbox-href";
import { TODAY_CARD, TODAY_GRID, TODAY_LABEL, TODAY_SECTION } from "@/components/dashboard/today-home-layout";
import type { WorklistPerson } from "@/lib/data/today";

const BADGE = "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[13px] font-semibold";

function QueueRow({
  href,
  icon: Icon,
  label,
  count,
  accent,
  featured,
  control,
}: {
  href: string;
  icon: typeof Clock;
  label: string;
  count: number;
  accent?: boolean;
  featured?: boolean;
  control: string;
}) {
  const hot = featured && count > 0;
  return (
    <Link
      href={href}
      data-today-control={control}
      className={cn(
        "flex h-full min-h-[58px] min-w-0 items-center gap-3 px-3.5 py-3.5",
        TODAY_CARD,
        hot && "border-2 border-[#c45c4a] bg-[#fff7f4] shadow-[0_4px_14px_rgb(196_92_74_/_0.18)]",
      )}
    >
      <Icon size={20} strokeWidth={1.7} className={cn("shrink-0", hot || accent || count > 0 ? "text-[#c45c4a]" : "text-neutral-500")} />
      <p className="min-w-0 flex-1 truncate text-[16px] text-neutral-900">
        {label}
        <span className={cn(hot ? "font-semibold text-[#c45c4a]" : "text-neutral-400")}> · {count}</span>
      </p>
      <span
        className={cn(
          BADGE,
          hot ? "h-8 min-w-8 bg-[#c45c4a] text-[15px] text-white" : count > 0 ? "bg-[#c45c4a] text-white" : "bg-[#f0e4df] text-neutral-500",
        )}
      >
        {count}
      </span>
      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-neutral-300" />
    </Link>
  );
}

export function NewUncontactedSpotlight({ count, previewName }: { count: number; previewName?: string }) {
  if (count <= 0) return null;
  const subtitle =
    count === 1
      ? previewName
        ? `${previewName} is waiting for a first text`
        : "1 new lead waiting — tap to text"
      : `${count} new leads waiting — tap to text`;

  return (
    <Link
      href={todayFocusHref("new")}
      data-today-control="home-new-uncontacted"
      data-today-home="new-uncontacted"
      className="flex items-center gap-4 rounded-[20px] border-2 border-[#c45c4a] bg-[#fff7f4] px-4 py-4 shadow-[0_6px_18px_rgb(196_92_74_/_0.16)]"
    >
      <div className="flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-[18px] bg-[#c45c4a] text-white shadow-[0_4px_10px_rgb(196_92_74_/_0.28)]">
        <p className="font-serif text-[28px] font-semibold leading-none">{count}</p>
        <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80">New</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c45c4a]">First touch</p>
        <p className="mt-0.5 font-serif text-[22px] font-semibold leading-7 text-neutral-900">New / uncontacted</p>
        <p className="mt-0.5 truncate text-[14px] text-neutral-600">{subtitle}</p>
      </div>
      <ChevronRight size={20} strokeWidth={1.75} className="shrink-0 text-[#c45c4a]" />
    </Link>
  );
}

export function TodayQueues({
  overdueCount,
  callTodayCount,
  newUncontactedCount,
  quietCount,
  messages,
  spamFilteredCount = 0,
  wide = false,
  afterDoNext,
}: {
  overdueCount: number;
  callTodayCount: number;
  newUncontactedCount: number;
  quietCount: number;
  messages: WorklistPerson[];
  spamFilteredCount?: number;
  wide?: boolean;
  afterDoNext?: ReactNode;
}) {
  const owedCount = messages.length;

  const doNext = (
    <section className={TODAY_SECTION} data-today-home="do-next">
      <p className={TODAY_LABEL}>Do next</p>
      <div className={wide ? "grid grid-cols-3 gap-6" : "grid grid-cols-1 gap-2.5"}>
        <QueueRow href={todayFocusHref("new")} icon={UserPlus} label="New / uncontacted" count={newUncontactedCount} featured control="queue-new" />
        <QueueRow href={todayFocusHref("overdue")} icon={Clock} label="Overdue" count={overdueCount} accent control="queue-overdue" />
        <QueueRow href={todayFocusHref("call-today")} icon={Phone} label="Call today" count={callTodayCount} control="queue-call-today" />
      </div>
    </section>
  );

  const quiet = (
    <section className={TODAY_SECTION}>
      <p className={TODAY_LABEL}>Quiet leads</p>
      <QueueRow href={todayFocusHref("quiet")} icon={Bell} label="No touch 14+ days" count={quietCount} control="queue-quiet" />
    </section>
  );

  const inbox = (
    <section className={TODAY_SECTION}>
      <p className={TODAY_LABEL}>Messages</p>
      <Link
        href="/messages"
        data-today-control="messages"
        className={cn("block px-3.5 py-3.5", TODAY_CARD)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c45c4a] text-white shadow-[0_4px_10px_rgb(196_92_74_/_0.28)]">
            <MessageCircle size={18} strokeWidth={1.6} fill="currentColor" />
          </div>
          <p className={cn("min-w-0 flex-1 font-serif text-[18px] font-semibold", owedCount > 0 ? "text-[#c45c4a]" : "text-neutral-700")}>
            {owedCount === 0 ? "Inbox is clear" : `${owedCount} need${owedCount === 1 ? "s" : ""} a reply`}
          </p>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-neutral-300" />
        </div>
        {messages.slice(0, wide ? 5 : 2).map((m) => (
          <p key={m.id} className="mt-1 truncate pl-[52px] text-[14px] text-neutral-500">
            <span className="text-neutral-800">{m.name}</span>
            {m.meta ? ` · ${m.meta}` : ""}
          </p>
        ))}
      </Link>
      {spamFilteredCount > 0 && (
        <Link
          href={inboxHref({ spam: true })}
          data-today-control="spam-filtered"
          className="flex min-h-11 items-center gap-2 px-1 text-[13px] text-neutral-400"
        >
          <ShieldAlert size={14} className="shrink-0" />
          Spam filtered · {spamFilteredCount}
          <ChevronRight size={14} className="ml-auto shrink-0 text-neutral-300" />
        </Link>
      )}
    </section>
  );

  if (wide) {
    return (
      <>
        {doNext}
        {afterDoNext}
        <div className={cn(TODAY_GRID, "items-start")}>
          <div className="col-span-12 min-w-0 xl:col-span-6">{quiet}</div>
          <div className="col-span-12 min-w-0 xl:col-span-6">{inbox}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {doNext}
      {afterDoNext}
      {quiet}
      {inbox}
    </>
  );
}
