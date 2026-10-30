"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dismissReplyOwed, clearFollowUp, dismissRegisteredNoFollowUp, markKnownPersonally, dismissNewLead } from "@/app/(app)/today-actions";
import { WorklistGroup } from "@/components/dashboard/WorklistGroup";
import { BookingRequestRow } from "@/components/scheduling/BookingRequestRow";
import { TodayTasksGroup } from "@/components/dashboard/TodayTasksGroup";
import { TextAllButton } from "@/components/dashboard/TextAllButton";
import { cn } from "@/lib/utils";
import { TodayWorklistDesktop } from "@/components/dashboard/TodayWorklistDesktop";
import {
  FOCUS_TO_CHIP,
  TODAY_QUEUE_SHORT_LABELS,
  TODAY_QUEUE_SWITCHER,
  TODAY_QUEUE_TITLES,
  countForFocus,
  todayFocusHref,
  type TodayChipKey,
  type TodayFocus,
  type TodayPersonGroups,
} from "@/lib/crm/today-focus";
import type { WorklistTask } from "@/lib/data/today";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";
import type { MergeCandidate } from "@/lib/data/contacts";

export function TodayQueuePanel({
  focus,
  initialChip,
  groups,
  tasks,
  ownerId,
  contacts,
  bookingRequests,
  newLeadsError,
}: {
  focus: TodayFocus;
  initialChip?: TodayChipKey;
  groups: TodayPersonGroups;
  tasks: WorklistTask[];
  ownerId: string;
  contacts: MergeCandidate[];
  bookingRequests: BookingRequestWithContact[];
  newLeadsError: string | null;
}) {
  const title = TODAY_QUEUE_TITLES[focus];
  const count = countForFocus(focus, groups, tasks.length, bookingRequests.length);

  let body: React.ReactNode;
  switch (focus) {
    case "tasks":
      body = <TodayTasksGroup tasks={tasks} ownerId={ownerId} contacts={contacts} />;
      break;
    case "meetings":
      body =
        bookingRequests.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-neutral-400">Nothing here right now.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {bookingRequests.map((r) => (
              <BookingRequestRow key={r.id} request={r} />
            ))}
          </div>
        );
      break;
    case "new":
      body = newLeadsError ? (
        <p className="px-4 py-6 text-center text-sm text-red-700">Couldn&apos;t load new leads: {newLeadsError}</p>
      ) : (
        <WorklistGroup people={groups.newUncontacted} onDismissContact={dismissNewLead} dismissContactLabel="Doesn't need a follow-up" />
      );
      break;
    case "messages":
      body = <WorklistGroup people={groups.owed} onDismiss={dismissReplyOwed} dismissLabel="Doesn't need a reply" />;
      break;
    case "registered":
      body = (
        <WorklistGroup
          people={groups.registered}
          onDismissContact={dismissRegisteredNoFollowUp}
          dismissContactLabel="No follow-up needed"
          onNeverQueue={markKnownPersonally}
        />
      );
      break;
    case "overdue":
      body = <WorklistGroup people={groups.late} onDismissContact={clearFollowUp} dismissContactLabel="Clear follow-up" />;
      break;
    case "call-today":
      body = <WorklistGroup people={groups.dueToday} onDismissContact={clearFollowUp} dismissContactLabel="Clear follow-up" />;
      break;
    case "quiet":
      body = <WorklistGroup people={groups.quiet} />;
      break;
    default: {
      const _exhaustive: never = focus;
      throw new Error(`Unhandled Today focus: ${_exhaustive}`);
    }
  }

  return (
    <div id="today-queue" className="scroll-mt-4">
      <Link
        href="/"
        data-today-control="back-today"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-neutral-500"
      >
        <ArrowLeft size={16} /> Today
      </Link>

      <h2 className="font-display text-[30px] font-semibold leading-8 tracking-[-0.03em] text-neutral-900">{title}</h2>
      <p className="mt-1.5 text-[15px] text-neutral-500">{count === 0 ? "Nothing in this queue." : `${count} in this queue`}</p>

      <div className="mt-4 hidden lg:block">
        <TodayWorklistDesktop
          key={focus}
          initialChip={initialChip ?? FOCUS_TO_CHIP[focus]}
          groups={groups}
          bookingRequests={bookingRequests}
          tasks={tasks}
          ownerId={ownerId}
          contacts={contacts}
          newLeadsError={newLeadsError}
        />
      </div>

      <div className="mt-4 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TODAY_QUEUE_SWITCHER.map((key) => {
            const n = countForFocus(key, groups, tasks.length, bookingRequests.length);
            return (
              <Link
                key={key}
                href={todayFocusHref(key)}
                data-today-control={`chip-${key}`}
                className={cn(
                  "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium",
                  focus === key ? "bg-[#c45c4a] text-white shadow-[0_4px_10px_rgb(196_92_74_/_0.28)]" : "border border-[#eadfd6] bg-[#fffbf8] text-neutral-600",
                )}
              >
                {TODAY_QUEUE_SHORT_LABELS[key]} {n}
              </Link>
            );
          })}
        </div>

        {focus === "registered" && groups.registered.length > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] px-[18px] py-3.5 shadow-card">
            <p className="min-w-0 flex-1 text-[15px] text-neutral-700">Registered for something and hasn&apos;t heard from you since.</p>
            <TextAllButton contactIds={groups.registered.map((p) => p.id)} label="Registered, no follow-up" />
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] shadow-card">{body}</div>

        {focus === "registered" && groups.registered.length > 0 && (
          <p className="mt-2 px-1 text-[13px] text-neutral-400">
            People marked &quot;never queue&quot; are listed in Settings → People you know.
          </p>
        )}
      </div>
    </div>
  );
}
