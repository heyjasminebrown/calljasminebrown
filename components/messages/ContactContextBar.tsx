"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { RepresentingBadge } from "@/components/contacts/RepresentingBadge";
import { LikelihoodBadge } from "@/components/contacts/LikelihoodBadge";
import { SnoozeMenu } from "@/components/contacts/SnoozeMenu";
import { computeLikelihood } from "@/lib/crm/likelihood";
import { formatCurrency, TIMELINE_LABELS } from "@/lib/utils";
import { formatLocal, isFollowUpOverdue } from "@/lib/format-time";
import { clearFollowUp, snoozeFollowUp } from "@/app/(app)/today-actions";
import { CalendarClock, Check, Bell, Plus, ChevronRight } from "lucide-react";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

// Everything worth knowing at a glance before texting someone - who they
// are in the pipeline, how urgent, and whether they're overdue for a
// follow-up - without leaving the thread to go check their profile.
// Create follow-up lives here so a thread can become a dated next-action
// without opening the contact record.
export function ContactContextBar({ contact, stages }: { contact: ContactWithRelations; stages: PipelineStage[] }) {
  const router = useRouter();
  const stage = contact.pipeline_stages;
  const likelihood = computeLikelihood(contact, stages);
  const isOverdue = isFollowUpOverdue(contact.next_follow_up_at);
  const hasBudget = contact.budget_min || contact.budget_max;
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function createOrSnooze(days: number) {
    setMenuOpen(false);
    setBusy(true);
    const res = await snoozeFollowUp(contact.id, days);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function complete() {
    setBusy(true);
    const res = await clearFollowUp(contact.id);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-1.5 border-b border-neutral-100 bg-neutral-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {stage && (
          <Badge className="max-w-[10rem] truncate px-2 py-0.5 text-[11px]" color={stage.color}>
            {stage.name}
          </Badge>
        )}
        <RepresentingBadge representing={contact.representing} />
        <LikelihoodBadge likelihood={likelihood} />
        {contact.timeline && contact.timeline !== "unknown" && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
            {TIMELINE_LABELS[contact.timeline]}
          </span>
        )}
        {contact.contact_tags
          .filter((ct) => ct.tags)
          .map((ct) => (
            <Badge key={ct.tags!.id} color={ct.tags!.color} className="max-w-[10rem] truncate px-2 py-0.5 text-[11px]">
              {ct.tags!.name}
            </Badge>
          ))}
        <Link
          href={`/contacts/${contact.id}`}
          className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-600"
        >
          Open record <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-neutral-500">
        {contact.next_follow_up_at ? (
          <>
            <span className={`flex items-center gap-1 ${isOverdue ? "font-medium text-red-600" : ""}`}>
              <CalendarClock size={12} />
              {isOverdue ? "Follow-up overdue: " : "Follow-up: "}
              {formatLocal(contact.next_follow_up_at, "MMM d")}
            </span>
            <button
              type="button"
              onClick={complete}
              disabled={busy}
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-800 disabled:opacity-50"
            >
              <Check size={11} /> Complete
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={busy}
                className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-800 disabled:opacity-50"
              >
                <Bell size={11} /> Snooze
              </button>
              {menuOpen && <SnoozeMenu onPick={createOrSnooze} align="left" />}
            </div>
          </>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              disabled={busy}
              className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-neutral-800 disabled:opacity-50"
            >
              <Plus size={11} /> Create follow-up
            </button>
            {menuOpen && <SnoozeMenu onPick={createOrSnooze} align="left" />}
          </div>
        )}
        {hasBudget && (
          <span>
            Budget: {contact.budget_min ? formatCurrency(contact.budget_min) : "—"}
            {" – "}
            {contact.budget_max ? formatCurrency(contact.budget_max) : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
