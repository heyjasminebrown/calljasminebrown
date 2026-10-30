"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PersonCard } from "@/components/dialer/PersonCard";
import { RecentThreadPanel } from "@/components/dialer/RecentThreadPanel";
import { UpNextList } from "@/components/dialer/UpNextList";
import { BulkSendCard } from "@/components/dialer/BulkSendCard";
import { AddSomeoneCard } from "@/components/dialer/AddSomeoneCard";
import { cn } from "@/lib/utils";
import type { DialerContact, DialerMode, UpcomingConfirmationEvent } from "@/lib/data/dialer";
import type { TextTemplate } from "@/types/database";

type Tab = "followup" | "confirm";

// One workspace, one queue, one card - the tabs used to be three
// different products (a mobile-only card flow for two of them, a flat
// list + modal for the third, and Confirm was its own screen with its
// own header and no progress bar at all). Header, progress and card are
// now shared across all three; only the data (contacts, mode) and a
// couple of confirm-only extras (Add someone, the event name in the
// subtitle) change.
export function DialerWorkspace({
  contacts,
  mode,
  activeTab,
  followupCount,
  confirmCount,
  confirmationEvents,
  defaultDraftTemplate,
  emptyMessage,
}: {
  contacts: DialerContact[];
  mode: DialerMode;
  activeTab: Tab;
  followupCount: number;
  confirmCount: number;
  confirmationEvents: UpcomingConfirmationEvent[];
  defaultDraftTemplate: TextTemplate | null;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(contacts);
  const [addingSomeone, setAddingSomeone] = useState(false);
  const current = queue[0];
  const startCount = contacts.length;
  const doneCount = startCount - queue.length;

  function advance() {
    setQueue((q) => q.slice(1));
  }

  const subtitle =
    mode === "confirmation"
      ? `${confirmationEvents.length === 1 ? confirmationEvents[0].eventName : "Events in the next couple days"} · ${queue.length} left`
      : `Post-event follow-ups · ${doneCount} of ${startCount} done`;

  const tabs: { key: Tab; href: string; label: string; count: number }[] = [
    { key: "followup", href: "/dialer", label: "Post-event", count: followupCount },
    { key: "confirm", href: "/dialer?tab=confirm", label: "Confirm", count: confirmCount },
  ];

  return (
    <>
      {/* Mobile */}
      <div className="px-4 pb-8 pt-5 md:hidden">
        <p className="font-serif text-2xl font-semibold text-neutral-900">Event calls</p>
        <p className="mt-0.5 text-[15px] text-neutral-500">{subtitle}</p>
        <p className="mt-1 text-[13px] text-neutral-400">
          Daily follow-up calls live on{" "}
          <Link href="/" className="font-medium text-brand-700">
            Today
          </Link>
          . This is meetup follow-up and confirmations.
        </p>

        <div className="mt-3 flex gap-1.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "h-11 flex-1 rounded-[12px] text-center text-[15px] font-semibold leading-[44px]",
                activeTab === t.key ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-700",
              )}
            >
              {t.label.split(" ")[0]} {t.count}
            </Link>
          ))}
        </div>

        {startCount > 0 && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / startCount) * 100}%` }} />
            </div>
            <span className="shrink-0 text-sm font-medium text-neutral-500">{queue.length} left</span>
          </div>
        )}

        {mode === "confirmation" &&
          (addingSomeone ? (
            <div className="mt-3">
              <AddSomeoneCard
                events={confirmationEvents}
                onClose={() => setAddingSomeone(false)}
                onAdded={() => {
                  setAddingSomeone(false);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSomeone(true)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 bg-white py-3 text-sm font-semibold text-neutral-600"
            >
              <Plus size={15} /> Add someone who hasn&apos;t registered
            </button>
          ))}

        <div className="mt-4">
          {current ? (
            <PersonCard key={current.id} contact={current} mode={mode} layout="mobile" defaultDraftTemplate={defaultDraftTemplate} onAdvance={advance} />
          ) : (
            <div className="rounded-[20px] border border-[#ebe9e7] bg-white p-8 text-center">
              <p className="text-[16px] font-medium text-neutral-600">{emptyMessage}</p>
            </div>
          )}
        </div>

        <UpNextList contacts={queue.slice(1)} layout="mobile" />
        {queue.length > 0 && (
          <div className="mt-3">
            <BulkSendCard contacts={queue} label={mode === "event-followup" ? "Post-event follow-ups" : "Confirmations"} />
          </div>
        )}
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden max-w-[900px] px-4 py-6 md:block">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold text-neutral-900">Event calls</h1>
            <p className="mt-0.5 whitespace-nowrap text-[15px] text-neutral-500">{subtitle}</p>
            <p className="mt-1 text-[13px] text-neutral-400">
              Daily follow-up calls live on{" "}
              <Link href="/" className="font-medium text-brand-700 hover:underline">
                Today
              </Link>
              . This is meetup follow-up and confirmations.
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={cn(
                  "flex h-11 items-center whitespace-nowrap rounded-xl px-4 text-[15px] font-semibold",
                  activeTab === t.key ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700",
                )}
              >
                {t.label} {t.count}
              </Link>
            ))}
          </div>
        </div>

        {startCount > 0 && (
          <div className="mt-3.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / startCount) * 100}%` }} />
            </div>
            <span className="shrink-0 text-sm font-medium text-neutral-500">{queue.length} left</span>
          </div>
        )}

        {mode === "confirmation" &&
          (addingSomeone ? (
            <div className="mt-3.5">
              <AddSomeoneCard
                events={confirmationEvents}
                onClose={() => setAddingSomeone(false)}
                onAdded={() => {
                  setAddingSomeone(false);
                  router.refresh();
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSomeone(true)}
              className="mt-3.5 flex items-center gap-1.5 text-sm font-semibold text-brand-600"
            >
              <Plus size={15} /> Add someone who hasn&apos;t registered
            </button>
          ))}

        <div className="mt-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            {current ? (
              <PersonCard key={current.id} contact={current} mode={mode} layout="desktop" defaultDraftTemplate={defaultDraftTemplate} onAdvance={advance} />
            ) : (
              <div className="rounded-[20px] border border-[#ebe9e7] bg-white p-8 text-center">
                <p className="text-[16px] font-medium text-neutral-600">{emptyMessage}</p>
              </div>
            )}
          </div>
          {current && (
            <div className="w-[340px] shrink-0">
              <RecentThreadPanel contactId={current.id} />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <UpNextList contacts={queue.slice(1)} layout="desktop" />
          </div>
          {queue.length > 0 && (
            <div className="w-[340px] shrink-0">
              <BulkSendCard contacts={queue} label={mode === "event-followup" ? "Post-event follow-ups" : "Confirmations"} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
