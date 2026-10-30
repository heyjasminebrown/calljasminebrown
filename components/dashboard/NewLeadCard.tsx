"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Phone, History } from "lucide-react";
import { Avatar } from "@/components/ui";
import { openQuoCall } from "@/lib/quo/call-link";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { dismissNewLead } from "@/app/(app)/today-actions";
import { RecentThreadPanel } from "@/components/dialer/RecentThreadPanel";
import { buildNewLeadDraft, resolveNewLeadSource } from "@/lib/crm/new-lead-text-templates";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { fullName, formatPhone, cn } from "@/lib/utils";
import type { NewLeadContact } from "@/lib/data/new-leads";
import type { TextTemplate } from "@/types/database";

// Modeled on components/dialer/PersonCard.tsx's structure (header, template
// chips, editable draft, Call) but trimmed to this feature's actual
// interaction set - no Connected/No-answer/Not-now outcome footer, since
// New Leads has only two real outcomes: text & advance (which naturally
// removes the contact from the query once it logs an outbound activity),
// or a permanent "doesn't need a follow-up" dismiss. Bolting this onto
// PersonCard as a 4th DialerMode would tangle it with registration-only
// fields (isNew, registrationLabel, confirmation eventId/eventStart) that
// don't apply here.
export function NewLeadCard({
  contact,
  layout = "mobile",
  defaultDraftTemplate,
  onAdvance,
}: {
  contact: NewLeadContact;
  layout?: "mobile" | "desktop";
  defaultDraftTemplate: TextTemplate | null;
  onAdvance: () => void;
}) {
  const router = useRouter();
  const source = resolveNewLeadSource(contact.lead_source);

  const templates: { label: string; body: string }[] = [
    {
      label: "Suggested",
      body: buildNewLeadDraft(contact.first_name, contact.lead_source, {
        lastEventName: contact.last_event_name,
        tagNames: contact.tagNames,
      }),
    },
    {
      label: defaultDraftTemplate?.label ?? "Quick text",
      body: defaultDraftTemplate ? applyMergeFields(defaultDraftTemplate.body, contact) : "",
    },
  ];

  const [draft, setDraft] = useState(templates[0].body);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [sending, setSending] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  function pickTemplate(i: number) {
    setActiveTemplate(i);
    setDraft(templates[i]?.body ?? "");
  }

  async function sendAndNext() {
    if (!contact.phone || !draft.trim()) return;
    setSending(true);
    const res = await sendTextToContact(contact.id, contact.phone, applyMergeFields(draft, contact).trim());
    setSending(false);
    if (res.ok) {
      router.refresh();
      onAdvance();
    }
  }

  function call() {
    if (!contact.phone) return;
    openQuoCall(contact.phone);
  }

  async function dismiss() {
    setDismissing(true);
    await dismissNewLead(contact.id);
    setDismissing(false);
    router.refresh();
    onAdvance();
  }

  return (
    <div className={cn("rounded-[20px] border border-[#ebe9e7] bg-white", layout === "desktop" ? "p-5" : "p-4")}>
      <div className="flex items-center gap-3.5">
        <Avatar firstName={contact.first_name} lastName={contact.last_name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[21px] font-semibold text-neutral-900">{fullName(contact)}</p>
          <p className="truncate text-[15px] text-neutral-500">
            {[source.label, layout === "desktop" ? formatPhone(contact.phone) : null].filter(Boolean).join(" · ") || formatPhone(contact.phone)}
          </p>
        </div>
        {layout === "desktop" && (
          <Link href={`/contacts/${contact.id}`} target="_blank" className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand-600">
            <History size={14} /> Full history
          </Link>
        )}
      </div>

      {layout === "mobile" && (
        <div className="mt-2 flex items-center gap-1 text-[13px] font-medium text-brand-600">
          <Link href={`/contacts/${contact.id}`} target="_blank" className="flex items-center gap-1">
            <History size={12} /> Full history
          </Link>
        </div>
      )}

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
          <Send size={17} /> {sending ? "Sending…" : "Text & next"}
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

      <button
        type="button"
        onClick={dismiss}
        disabled={dismissing}
        className="mt-3 w-full text-center text-[13px] font-medium text-neutral-400 disabled:opacity-50"
      >
        {dismissing ? "Removing…" : "Doesn't need a follow-up · don't show again"}
      </button>
    </div>
  );
}
