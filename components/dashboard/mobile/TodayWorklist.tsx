"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquareText, Phone, X, RotateCcw, UserMinus } from "lucide-react";
import { ListRow } from "@/components/mobile/ListRow";
import { SwipeActions } from "@/components/mobile/SwipeActions";
import { Toast } from "@/components/mobile/Toast";
import { BookingRequestRow } from "@/components/scheduling/BookingRequestRow";
import { TodayTasksGroup } from "@/components/dashboard/TodayTasksGroup";
import { useToast } from "@/lib/hooks/useToast";
import { openQuoCall } from "@/lib/quo/call-link";
import { clearFollowUp, dismissRegisteredNoFollowUp, markKnownPersonally } from "@/app/(app)/today-actions";
import { CHIP_TO_FOCUS, todayFocusHref, type TodayChipKey } from "@/lib/crm/today-focus";
import { cn } from "@/lib/utils";
import type { WorklistPerson, WorklistTask } from "@/lib/data/today";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";
import type { MergeCandidate } from "@/lib/data/contacts";

export type { TodayChipKey };

export function TodayWorklist({
  groups,
  tasks,
  ownerId,
  contacts,
  bookingRequests,
  initialChip,
}: {
  groups: Record<"late" | "dueToday" | "owed" | "registered" | "newUncontacted" | "quiet", WorklistPerson[]>;
  tasks: WorklistTask[];
  ownerId: string;
  contacts: MergeCandidate[];
  bookingRequests: BookingRequestWithContact[];
  initialChip?: TodayChipKey;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const chips: { key: TodayChipKey; label: string }[] = [
    { key: "late", label: `Overdue ${groups.late.length}` },
    { key: "dueToday", label: `Call today ${groups.dueToday.length}` },
    { key: "newUncontacted", label: `New ${groups.newUncontacted.length}` },
    { key: "quiet", label: `Quiet ${groups.quiet.length}` },
    { key: "owed", label: `Owed a reply ${groups.owed.length}` },
    { key: "tasks", label: `My tasks ${tasks.length}` },
    { key: "registered", label: `Registered ${groups.registered.length}` },
    { key: "meetings", label: `Meetings ${bookingRequests.length}` },
  ];
  const isNonEmpty = (key: TodayChipKey) =>
    key === "tasks" ? tasks.length > 0 : key === "meetings" ? bookingRequests.length > 0 : groups[key].length > 0;
  const firstNonEmpty = chips.find((c) => isNonEmpty(c.key))?.key ?? "late";
  const [active, setActive] = useState<TodayChipKey>(initialChip ?? firstNonEmpty);

  useEffect(() => {
    if (initialChip) setActive(initialChip);
  }, [initialChip]);

  // Late/due-today both come from today.calls - the only groups where "I
  // don't need to call this person" (clearing next_follow_up_at) applies.
  const isCallGroup = active === "late" || active === "dueToday";
  const isPersonGroup =
    active === "late" || active === "dueToday" || active === "owed" || active === "registered" || active === "newUncontacted" || active === "quiet";
  const people = isPersonGroup ? groups[active].filter((p) => !cleared.has(p.id)) : [];

  async function handleClear(contactId: string) {
    const res = await clearFollowUp(contactId);
    if (!res.ok) {
      showToast("Couldn't clear that", "error");
      return;
    }
    setCleared((prev) => new Set(prev).add(contactId));
  }

  async function handleNotThisTime(contactId: string) {
    const res = await dismissRegisteredNoFollowUp(contactId);
    if (!res.ok) {
      showToast("Couldn't dismiss that", "error");
      return;
    }
    setCleared((prev) => new Set(prev).add(contactId));
    router.refresh();
  }

  async function handleNeverQueue(contactId: string) {
    const res = await markKnownPersonally(contactId);
    if (!res.ok) {
      showToast("Couldn't update that", "error");
      return;
    }
    setCleared((prev) => new Set(prev).add(contactId));
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={todayFocusHref(CHIP_TO_FOCUS[chip.key])}
            onClick={() => setActive(chip.key)}
            className={cn(
              "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium",
              active === chip.key ? "bg-[#c45c4a] text-white" : "border border-[#eadfd6] bg-[#fffbf8] text-neutral-600",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-[16px] border border-[#ebe9e7] bg-white">
        {active === "tasks" ? (
          <TodayTasksGroup tasks={tasks} ownerId={ownerId} contacts={contacts} />
        ) : active === "meetings" ? (
          bookingRequests.length === 0 ? (
            <p className="px-4 py-6 text-center text-[15px] text-neutral-400">Nothing here.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {bookingRequests.map((r) => (
                <BookingRequestRow key={r.id} request={r} />
              ))}
            </div>
          )
        ) : people.length === 0 ? (
          <p className="px-4 py-6 text-center text-[15px] text-neutral-400">Nothing here.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {people.map((person) => {
              const row = (
                <ListRow
                  href={`/contacts/${person.id}`}
                  avatar={{ firstName: person.name.split(" ")[0] || "?", lastName: person.name.split(" ").slice(1).join(" ") }}
                  name={person.name}
                  secondaryText={person.meta}
                  secondaryTone={person.late ? "danger" : "default"}
                  trailingAction={
                    person.phone
                      ? active === "late"
                        ? { icon: Phone, variant: "secondary", "aria-label": "Call", onClick: () => openQuoCall(person.phone!) }
                        : {
                            icon: MessageSquareText,
                            variant: "primary",
                            "aria-label": "Text",
                            onClick: () => router.push(`/messages/${person.id}`),
                          }
                      : undefined
                  }
                />
              );
              if (isCallGroup) {
                return (
                  <SwipeActions
                    key={person.id}
                    rowId={person.id}
                    openRowId={openRowId}
                    onOpenChange={setOpenRowId}
                    actions={[{ icon: X, label: "Clear", bg: "#78716c", onClick: () => handleClear(person.id) }]}
                  >
                    {row}
                  </SwipeActions>
                );
              }
              if (active === "registered") {
                return (
                  <SwipeActions
                    key={person.id}
                    rowId={person.id}
                    openRowId={openRowId}
                    onOpenChange={setOpenRowId}
                    actions={[
                      { icon: RotateCcw, label: "Not this time", bg: "#78716c", onClick: () => handleNotThisTime(person.id) },
                      { icon: UserMinus, label: "Never queue", bg: "#1c1917", onClick: () => handleNeverQueue(person.id) },
                    ]}
                  >
                    {row}
                  </SwipeActions>
                );
              }
              return <div key={person.id}>{row}</div>;
            })}
          </div>
        )}
        {isCallGroup && people.length > 0 && (
          <p className="border-t border-neutral-100 px-4 py-2.5 text-[13px] text-neutral-400">Swipe a row left to clear the follow-up</p>
        )}
      </div>

      {active === "registered" && people.length > 0 && (
        <p className="mt-2 px-1 text-[13px] text-neutral-400">
          People marked &quot;never queue&quot; are listed in Settings → People you know.
        </p>
      )}
      <Toast toast={toast} />
    </div>
  );
}
