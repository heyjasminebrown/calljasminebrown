"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dismissReplyOwed, clearFollowUp, dismissRegisteredNoFollowUp, markKnownPersonally, dismissNewLead } from "@/app/(app)/today-actions";
import { WorklistGroup } from "@/components/dashboard/WorklistGroup";
import { BookingRequestRow } from "@/components/scheduling/BookingRequestRow";
import { TodayTasksGroup } from "@/components/dashboard/TodayTasksGroup";
import { TextAllButton } from "@/components/dashboard/TextAllButton";
import { CHIP_TO_FOCUS, todayFocusHref, type TodayChipKey } from "@/lib/crm/today-focus";
import { cn } from "@/lib/utils";
import type { WorklistPerson, WorklistTask } from "@/lib/data/today";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";
import type { MergeCandidate } from "@/lib/data/contacts";

export type TodayDesktopChipKey = TodayChipKey;

// Desktop drill-in list. Home does not mount this (queue-first cards only).
// `/?focus=new` maps to initialChip=newUncontacted via FOCUS_TO_CHIP.
export function TodayWorklistDesktop({
  groups,
  bookingRequests,
  tasks = [],
  ownerId = "",
  contacts = [],
  initialChip,
  newLeadsError = null,
}: {
  groups: Record<"late" | "dueToday" | "owed" | "registered" | "newUncontacted" | "quiet", WorklistPerson[]>;
  bookingRequests: BookingRequestWithContact[];
  tasks?: WorklistTask[];
  ownerId?: string;
  contacts?: MergeCandidate[];
  initialChip?: TodayChipKey;
  newLeadsError?: string | null;
}) {
  const chips: { key: TodayChipKey; label: string }[] = [
    { key: "late", label: `Overdue ${groups.late.length}` },
    { key: "dueToday", label: `Call today ${groups.dueToday.length}` },
    { key: "newUncontacted", label: `New ${groups.newUncontacted.length}` },
    { key: "quiet", label: `Quiet ${groups.quiet.length}` },
    { key: "tasks", label: `My tasks ${tasks.length}` },
    { key: "registered", label: `Registered ${groups.registered.length}` },
    { key: "meetings", label: `Meetings ${bookingRequests.length}` },
    { key: "owed", label: `Owed a reply ${groups.owed.length}` },
  ];
  const isNonEmpty = (key: TodayChipKey) =>
    key === "tasks" ? tasks.length > 0 : key === "meetings" ? bookingRequests.length > 0 : groups[key].length > 0;
  const firstNonEmpty = chips.find((c) => isNonEmpty(c.key))?.key ?? "late";
  const [active, setActive] = useState<TodayChipKey>(initialChip ?? firstNonEmpty);

  useEffect(() => {
    if (initialChip) setActive(initialChip);
  }, [initialChip]);

  let body: React.ReactNode;
  if (active === "tasks") {
    body = <TodayTasksGroup tasks={tasks} ownerId={ownerId} contacts={contacts} />;
  } else if (active === "meetings") {
    body =
      bookingRequests.length === 0 ? (
        <p className="px-4 py-6 text-[15px] text-neutral-400">Nothing here right now.</p>
      ) : (
        bookingRequests.map((r) => <BookingRequestRow key={r.id} request={r} />)
      );
  } else if (active === "newUncontacted") {
    body = newLeadsError ? (
      <p className="px-4 py-6 text-sm text-red-700">Couldn&apos;t load new leads: {newLeadsError}</p>
    ) : (
      <WorklistGroup people={groups.newUncontacted} onDismissContact={dismissNewLead} dismissContactLabel="Doesn't need a follow-up" />
    );
  } else if (active === "owed") {
    body = <WorklistGroup people={groups.owed} onDismiss={dismissReplyOwed} dismissLabel="Doesn't need a reply" />;
  } else if (active === "registered") {
    body = (
      <WorklistGroup
        people={groups.registered}
        onDismissContact={dismissRegisteredNoFollowUp}
        dismissContactLabel="No follow-up needed"
        onNeverQueue={markKnownPersonally}
      />
    );
  } else if (active === "quiet") {
    body = <WorklistGroup people={groups.quiet} />;
  } else {
    body = <WorklistGroup people={groups[active]} onDismissContact={clearFollowUp} dismissContactLabel="Clear follow-up" />;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={todayFocusHref(CHIP_TO_FOCUS[chip.key])}
            onClick={() => setActive(chip.key)}
            data-today-control={`chip-${CHIP_TO_FOCUS[chip.key]}`}
            className={cn(
              "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium",
              active === chip.key
                ? "bg-[#c45c4a] text-white shadow-[0_4px_10px_rgb(196_92_74_/_0.28)]"
                : "border border-[#eadfd6] bg-[#fffbf8] text-neutral-600",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {active === "registered" && groups.registered.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] px-[18px] py-3.5 shadow-card">
          <p className="min-w-0 flex-1 text-[15px] text-neutral-700">Registered for something and hasn&apos;t heard from you since.</p>
          <TextAllButton contactIds={groups.registered.map((p) => p.id)} label="Registered, no follow-up" />
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] shadow-card">{body}</div>

      {active === "registered" && groups.registered.length > 0 && (
        <p className="mt-3 px-0.5 text-sm leading-[21px] text-neutral-400">
          People marked &quot;never queue&quot; are listed in Settings → People you know, so the list is reviewable rather than invisible.
        </p>
      )}
    </div>
  );
}
