"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatLocal } from "@/lib/format-time";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { ContactDetailsCard } from "@/components/contacts/ContactDetailsCard";
import { SuggestedRow } from "@/components/contacts/SuggestedRow";
import { useToast } from "@/lib/hooks/useToast";
import { Toast } from "@/components/mobile/Toast";
import type { AiInsight, ContactWithRelations, PipelineStage, Tag, TextTemplate } from "@/types/database";
import type { MergeCandidate } from "@/lib/data/contacts";

export function OverviewTab({
  contact,
  tags,
  stages,
  mergeCandidates,
  textTemplates,
  insights,
  ownerId,
  openTasks,
  lastExchange,
}: {
  contact: ContactWithRelations;
  tags: Tag[];
  stages: PipelineStage[];
  mergeCandidates: MergeCandidate[];
  textTemplates: TextTemplate[];
  insights: AiInsight[];
  ownerId: string;
  openTasks: { id: string; title: string; due_at: string | null }[];
  lastExchange: { body: string; occurred_at: string } | null;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function sendQuickText(template: TextTemplate) {
    if (!contact.phone) return;
    setSendingId(template.id);
    const body = applyMergeFields(template.body, contact);
    const res = await sendTextToContact(contact.id, contact.phone, body);
    setSendingId(null);
    if (!res.ok) showToast("Couldn't send that text", "error");
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      {contact.phone && textTemplates.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Quick texts</p>
          <div className="flex flex-wrap gap-2">
            {textTemplates.slice(0, 4).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => sendQuickText(t)}
                disabled={sendingId === t.id}
                className="h-[45px] rounded-full border border-neutral-200 px-3.5 text-[15px] font-medium text-neutral-700 disabled:opacity-50"
              >
                {sendingId === t.id ? "Sending…" : t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {lastExchange && (
        <div className="rounded-[16px] border border-[#ebe9e7] bg-white p-4">
          <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Last exchange</p>
          <p className="mt-1.5 text-[15px] leading-[21px] text-neutral-700">&quot;{lastExchange.body}&quot;</p>
          <p className="mt-1 text-[13px] text-neutral-400">{formatLocal(lastExchange.occurred_at, "MMM d, h:mm a")}</p>
        </div>
      )}

      {openTasks.length > 0 && (
        <div className="rounded-[16px] border border-[#ebe9e7] bg-white p-4">
          <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Open tasks</p>
          <div className="mt-1.5 space-y-1.5">
            {openTasks.map((t) => (
              <p key={t.id} className="text-[15px] text-neutral-700">
                {t.title}
                {t.due_at && <span className="text-neutral-400"> · {formatLocal(t.due_at, "MMM d")}</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Suggested</p>
          <div className="divide-y divide-neutral-100 rounded-[16px] border border-[#ebe9e7] bg-white">
            {insights.map((insight) => (
              <SuggestedRow
                key={insight.id}
                insight={insight}
                contactId={contact.id}
                ownerId={ownerId}
                contactStageId={contact.stage_id}
                contactName={`${contact.first_name} ${contact.last_name}`.trim()}
                contactCreatedAt={contact.created_at}
                representing={contact.representing}
                stages={stages}
                tags={tags}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Details</p>
        <ContactDetailsCard contact={contact} tags={tags} stages={stages} contacts={mergeCandidates} />
      </div>
      <Toast toast={toast} />
    </div>
  );
}
