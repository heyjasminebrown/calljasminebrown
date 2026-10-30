"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Send, Phone, PhoneMissed, Clock, Check, History } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { openQuoCall } from "@/lib/quo/call-link";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { markEventFollowupConnected, markEventFollowupSnoozed, markConfirmationConnected, markConfirmationSnoozed } from "@/app/(app)/dialer/actions";
import { MESSAGE_TEMPLATE_CATEGORIES } from "@/lib/crm/text-blast-templates";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { RecentThreadPanel } from "@/components/dialer/RecentThreadPanel";
import { fullName, formatPhone, cn } from "@/lib/utils";
import type { DialerContact, DialerMode } from "@/lib/data/dialer";
import type { TextTemplate } from "@/types/database";

const PRE_EVENT_TEMPLATES = MESSAGE_TEMPLATE_CATEGORIES.find((c) => c.key === "pre_event")!.options;
const FOLLOW_UP_TEMPLATES = MESSAGE_TEMPLATE_CATEGORIES.find((c) => c.key === "follow_up")!.options;

function daysBetweenCalendarDates(from: Date, to: Date): number {
  const startOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(to) - startOf(from)) / (24 * 60 * 60 * 1000));
}

function defaultPreEventIndex(eventStart: string): number {
  const daysUntil = daysBetweenCalendarDates(new Date(), new Date(eventStart));
  if (daysUntil <= 0) return 3;
  if (daysUntil === 1) return 2;
  if (daysUntil <= 4) return 1;
  return 0;
}

// One card, one model, both sizes - replaces the phone-only PersonCard
// plus desktop's separate DialerQueue/DialerCallModal pair. `layout`
// controls only the one real difference: mobile renders the recent-
// thread panel inline (it has no separate rail to put it in); desktop
// renders it as a sibling 340px column instead (see DialerWorkspace).
export function PersonCard({
  contact,
  mode,
  layout = "mobile",
  defaultDraftTemplate,
  onAdvance,
}: {
  contact: DialerContact;
  mode: DialerMode;
  layout?: "mobile" | "desktop";
  defaultDraftTemplate: TextTemplate | null;
  onAdvance: () => void;
}) {
  const router = useRouter();
  const eventName = mode === "confirmation" ? contact.registrationLabel : contact.last_event_name;
  const eventAccount = mode === "confirmation" ? contact.registrationAccount : null;
  const eventId = contact.confirmationEventId;
  const eventStart = contact.confirmationEventStart;

  const templates: { label: string; body: string }[] = [];
  if (mode === "event-followup") {
    for (const t of FOLLOW_UP_TEMPLATES) {
      templates.push({ label: t.label, body: applyMergeFields(t.build(eventAccount, eventName), contact) });
    }
  }
  if (mode === "confirmation" && eventStart) {
    for (const t of PRE_EVENT_TEMPLATES) {
      templates.push({ label: t.label, body: applyMergeFields(t.build(eventAccount, eventName), contact) });
    }
  }
  templates.push({
    label: defaultDraftTemplate?.label ?? "Quick text",
    body: defaultDraftTemplate ? applyMergeFields(defaultDraftTemplate.body, contact) : "",
  });

  const initialTemplate = mode === "confirmation" && eventStart ? defaultPreEventIndex(eventStart) : 0;
  const [draft, setDraft] = useState(templates[initialTemplate]?.body ?? templates[0]?.body ?? "");
  const [activeTemplate, setActiveTemplate] = useState(Math.min(initialTemplate, templates.length - 1));
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);

  function pickTemplate(i: number) {
    setActiveTemplate(i);
    setDraft(templates[i]?.body ?? "");
  }

  async function markConnected() {
    if (mode === "event-followup") return markEventFollowupConnected(contact.id);
    return markConfirmationConnected(contact.id, eventId!, eventName ?? "");
  }

  async function markSnoozed() {
    if (mode === "event-followup") return markEventFollowupSnoozed(contact.id);
    return markConfirmationSnoozed(contact.id, eventId!, eventName ?? "");
  }

  async function sendAndNext() {
    if (!contact.phone || !draft.trim()) return;
    setSending(true);
    const res = await sendTextToContact(contact.id, contact.phone, applyMergeFields(draft, contact).trim());
    setSending(false);
    if (res.ok) {
      await markConnected();
      router.refresh();
      onAdvance();
    }
  }

  function call() {
    if (!contact.phone) return;
    openQuoCall(contact.phone);
  }

  // Always visible now - previously gated behind tapping "Call instead"
  // first, so a call placed from the phone app directly couldn't be
  // logged without an extra pointless tap. No answer and Not now both
  // back onto the same snooze write (they move someone down the queue,
  // not out of it); Skip is gone as a separate control since Not now is
  // that exact outcome.
  async function outcome(kind: "connected" | "no-answer" | "not-now") {
    setMarking(true);
    if (kind === "connected") await markConnected();
    else await markSnoozed();
    setMarking(false);
    router.refresh();
    onAdvance();
  }

  return (
    <div className={cn("rounded-[20px] border border-[#ebe9e7] bg-white", layout === "desktop" ? "p-5" : "p-4")}>
      <div className="flex items-center gap-3.5">
        <Avatar firstName={contact.first_name} lastName={contact.last_name} size={52} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-serif font-semibold text-neutral-900", layout === "desktop" ? "text-[21px]" : "text-[21px]")}>{fullName(contact)}</p>
          <p className="truncate text-[15px] text-neutral-500">
            {[eventName, mode === "confirmation" ? null : contact.lead_source, layout === "desktop" ? formatPhone(contact.phone) : null]
              .filter(Boolean)
              .join(" · ") || formatPhone(contact.phone)}
          </p>
        </div>
        {layout === "desktop" && (
          <Link href={`/contacts/${contact.id}`} target="_blank" className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600">
            <History size={14} /> Full history
          </Link>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-400">
        {contact.dialer_snoozed_at && (
          <span className="flex items-center gap-1 text-amber-600">
            <Clock size={12} /> Tried {formatDistanceToNow(new Date(contact.dialer_snoozed_at), { addSuffix: true })}
          </span>
        )}
        {layout === "mobile" && (
          <Link href={`/contacts/${contact.id}`} target="_blank" className="flex items-center gap-1 font-medium text-brand-600">
            <History size={12} /> Full history
          </Link>
        )}
      </div>

      {layout === "mobile" && (
        <div className="mt-3">
          <RecentThreadPanel contactId={contact.id} />
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {templates.map((t, i) => (
          <button
            key={t.label + i}
            type="button"
            onClick={() => pickTemplate(i)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-[13px] font-medium",
              activeTemplate === i ? "border-transparent bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2 rounded-[16px] bg-neutral-50 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="w-full resize-none bg-transparent text-[15px] text-neutral-800 outline-none"
        />
        <p className="mt-1 text-[12px] text-neutral-400">Sending from your Quo number</p>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={sendAndNext}
          disabled={!contact.phone || sending || !draft.trim()}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-50",
            layout === "desktop" ? "h-[54px] text-[15px]" : "h-14 text-[15px]",
          )}
        >
          <Send size={17} /> {sending ? "Sending…" : "Send & next"}
        </button>
        <button
          type="button"
          onClick={call}
          disabled={!contact.phone}
          className={cn(
            "flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 font-semibold text-neutral-700 disabled:opacity-40",
            layout === "desktop" ? "h-[54px] px-[18px] text-[15px]" : "h-14 px-4 text-[15px]",
          )}
        >
          <Phone size={17} className="text-neutral-500" /> Call
        </button>
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3.5">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Log the outcome</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => outcome("connected")}
            disabled={marking}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            <Check size={16} /> Connected
          </button>
          <button
            type="button"
            onClick={() => outcome("no-answer")}
            disabled={marking}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 text-[15px] font-semibold text-neutral-700 disabled:opacity-50"
          >
            <PhoneMissed size={16} className="text-neutral-500" /> No answer
          </button>
          <button
            type="button"
            onClick={() => outcome("not-now")}
            disabled={marking}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 text-[15px] font-semibold text-neutral-700 disabled:opacity-50"
          >
            <Clock size={16} className="text-neutral-500" /> Not now
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-[19px] text-neutral-400">
          No answer and Not now both move them down the queue, not out of it. Always tappable - a call placed from your phone can be logged here without
          touching Call first.
        </p>
      </div>
    </div>
  );
}
