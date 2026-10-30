"use client";

// NOT mounted. Today home is queue-first cards — no black Up Next hero.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Phone, Clock, Check } from "lucide-react";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { dismissReplyOwed, snoozeFollowUp } from "@/app/(app)/today-actions";
import { openQuoCall } from "@/lib/quo/call-link";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { useToast } from "@/lib/hooks/useToast";
import { Toast } from "@/components/mobile/Toast";
import type { WorklistPerson } from "@/lib/data/today";
import type { TextTemplate } from "@/types/database";

export function UpNextCard({
  item,
  reason,
  draftTemplate,
  overrideDraft,
  moreCount,
}: {
  item: (WorklistPerson & { source: "call" | "reply" }) | null;
  reason: string;
  draftTemplate: TextTemplate | null;
  // Never-texted new registrations get the Dialer's own welcome/welcome-back
  // template here instead of the generic quick-text default - same intro
  // she'd get from the Dialer, just reachable straight from Up next too.
  overrideDraft?: string;
  // Desktop only: how many more people are behind this one in the
  // worklist below - when set, renders desktop's inline labelled button
  // row ("N more after this") instead of mobile's flex-1/square layout.
  moreCount?: number;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [handled, setHandled] = useState(false);
  const firstName = item?.name.split(" ")[0] ?? "";
  const lastName = item?.name.split(" ").slice(1).join(" ") ?? "";
  const hasDraft = !!overrideDraft || !!draftTemplate;
  const [draft, setDraft] = useState(
    () => overrideDraft ?? (draftTemplate ? applyMergeFields(draftTemplate.body, { first_name: firstName, last_name: lastName }) : ""),
  );
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!item || handled) {
    return (
      <div className="rounded-[20px] bg-neutral-900 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-white/60">Up next</p>
        <p className="mt-2 text-[17px] font-medium text-white/85">You&apos;re caught up - nothing urgent right now.</p>
      </div>
    );
  }

  async function send() {
    if (!item?.phone) return;
    setSending(true);
    setHandled(true);
    const res = await sendTextToContact(item.id, item.phone, applyMergeFields(draft, { first_name: firstName, last_name: lastName }).trim());
    setSending(false);
    if (!res.ok) {
      setHandled(false);
      showToast("Couldn't send that text", "error");
      return;
    }
    router.refresh();
  }

  async function call() {
    if (!item?.phone) return;
    openQuoCall(item.phone);
  }

  async function snooze() {
    const activeItem = item;
    if (!activeItem) return;
    setBusy(true);
    setHandled(true);
    const res =
      activeItem.source === "reply" && activeItem.activityId ? await dismissReplyOwed(activeItem.activityId) : await snoozeFollowUp(activeItem.id);
    setBusy(false);
    if (!res.ok) {
      setHandled(false);
      showToast("Couldn't snooze that", "error");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-[20px] bg-neutral-900 p-5">
      <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-white/60">Up next · {reason}</p>
      <p className="mt-1.5 font-serif text-2xl font-semibold text-white">{item.name}</p>
      <p className="mt-1 text-[15px] text-white/72">{item.meta}</p>

      {hasDraft && item.phone && (
        <div className="mt-3.5 rounded-[14px] bg-white/10 p-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-white/50">Draft</span>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-medium text-white/70">
                Edit
              </button>
            )}
          </div>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => setEditing(false)}
              autoFocus
              rows={3}
              className="w-full resize-none rounded-lg bg-transparent text-[15px] text-white outline-none"
            />
          ) : (
            <p className="text-[15px] leading-[21px] text-white">{draft}</p>
          )}
        </div>
      )}

      {moreCount !== undefined ? (
        <div className="mt-3.5 flex items-center gap-2">
          {item.phone && hasDraft && (
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="flex h-[52px] items-center justify-center gap-2 rounded-xl bg-white px-[22px] text-[15px] font-semibold text-neutral-900 disabled:opacity-50"
            >
              <Send size={17} /> {sending ? "Sending…" : "Send text"}
            </button>
          )}
          {item.phone && (
            <button
              type="button"
              onClick={call}
              className="flex h-[52px] items-center justify-center gap-2 rounded-xl border border-white/28 px-[18px] text-[15px] font-semibold text-white"
            >
              <Phone size={17} /> Call
            </button>
          )}
          <button
            type="button"
            onClick={snooze}
            disabled={busy}
            className="flex h-[52px] items-center justify-center gap-2 rounded-xl border border-white/28 px-[18px] text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? <Check size={17} /> : <Clock size={17} />} Snooze a day
          </button>
          {moreCount > 0 && <span className="ml-auto shrink-0 text-sm text-white/50">{moreCount} more after this</span>}
        </div>
      ) : (
        <div className="mt-3.5 flex gap-2">
          {item.phone && hasDraft && (
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="flex h-[54px] flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-neutral-900 disabled:opacity-50"
            >
              <Send size={17} /> {sending ? "Sending…" : "Send text"}
            </button>
          )}
          {item.phone && (
            <button type="button" onClick={call} className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border border-white/28 text-white">
              <Phone size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={snooze}
            disabled={busy}
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl border border-white/28 text-white disabled:opacity-50"
          >
            {busy ? <Check size={18} /> : <Clock size={18} />}
          </button>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}
