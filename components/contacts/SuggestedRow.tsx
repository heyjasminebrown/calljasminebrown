"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TIMELINE_LABELS } from "@/lib/utils";
import { applyStageChange, type DealModalMode, type PendingDealSummary } from "@/lib/crm/stage-transition";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import { cn } from "@/lib/utils";
import type { AiInsight, DealSide, PipelineStage, Representing, Tag } from "@/types/database";

// Row-shaped AI-insight display, replacing AiInsightCard's standalone
// card shape - used both on a contact's own Suggested card (one insight,
// contact implicit) and Today's Suggested tray (several insights across
// contacts, contact name shown via showContactName). Same
// apply/dismiss logic either place, just the one component so the two
// screens can't drift into different treatments.
export function SuggestedRow({
  insight,
  contactId,
  ownerId,
  contactStageId,
  contactName,
  contactCreatedAt,
  representing,
  stages,
  tags,
  showContactName = false,
  meta = null,
  extraInsightIds = [],
  stacked = false,
}: {
  insight: AiInsight;
  contactId: string;
  ownerId: string;
  contactStageId: string | null;
  contactName: string;
  contactCreatedAt: string;
  representing: Representing | null;
  stages: PipelineStage[];
  tags: Tag[];
  showContactName?: boolean;
  // Insights' grouped queue folds a contact's older undismissed insights
  // into this one row - appended to the suggestion line, and resolved
  // (dismissed, never applied) alongside whichever action this row takes.
  meta?: string | null;
  extraInsightIds?: string[];
  // Mobile's stacked button layout (44px-tall primary + 44x44 dismiss,
  // under the text) instead of desktop's inline right-aligned pair.
  stacked?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealModal, setDealModal] = useState<{ id: string; mode: DealModalMode } | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<PendingDealSummary[] | null>(null);

  const suggestedStage = stages.find((s) => s.id === insight.suggested_stage_id);
  const currentStage = stages.find((s) => s.id === contactStageId);
  const suggestedTags = (insight.suggested_tag_ids ?? []).map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => Boolean(t));
  const hasStageOrTimeline = !!suggestedStage || !!insight.suggested_timeline;
  const hasApplyTarget = hasStageOrTimeline || suggestedTags.length > 0;

  async function resolveExtras(supabase: ReturnType<typeof createClient>) {
    if (extraInsightIds.length === 0) return;
    await supabase.from("ai_insights").update({ dismissed: true }).in("id", extraInsightIds);
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: dismissError } = await supabase.from("ai_insights").update({ dismissed: true }).eq("id", insight.id);
    if (dismissError) {
      setBusy(false);
      setError(dismissError.message);
      return;
    }
    await resolveExtras(supabase);
    setBusy(false);
    router.refresh();
  }

  // Same fix as ApprovePanel's writeProposal and AiInsightCard's
  // handleApply - every write here used to fire without checking whether
  // it actually succeeded, so "Apply" could mark the insight applied with
  // nothing changed on the contact.
  async function handleApply() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (suggestedStage) {
      const { error: stageError, dealId, dealMode, pendingAtRisk } = await applyStageChange(supabase, ownerId, contactId, currentStage, suggestedStage);
      if (stageError) {
        setBusy(false);
        setError(stageError.message);
        return;
      }
      if (dealId && dealMode) setDealModal({ id: dealId, mode: dealMode });
      if (pendingAtRisk) setPendingCleanup(pendingAtRisk);
    }
    if (insight.suggested_timeline) {
      const { error: timelineError } = await supabase.from("contacts").update({ timeline: insight.suggested_timeline }).eq("id", contactId);
      if (timelineError) {
        setBusy(false);
        setError(timelineError.message);
        return;
      }
    }
    if (suggestedTags.length > 0) {
      const { error: tagError } = await supabase
        .from("contact_tags")
        .upsert(
          suggestedTags.map((t) => ({ contact_id: contactId, tag_id: t.id })),
          { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
        );
      if (tagError) {
        setBusy(false);
        setError(tagError.message);
        return;
      }
    }

    const { error: activityError } = await supabase.from("activities").insert({
      owner_id: ownerId,
      contact_id: contactId,
      type: "status_change",
      direction: "none",
      source: "ai",
      body: `AI-suggested update applied: ${insight.summary}`,
    });
    if (activityError) {
      setBusy(false);
      setError(activityError.message);
      return;
    }

    const { error: markError } = await supabase.from("ai_insights").update({ dismissed: true, applied: true }).eq("id", insight.id);
    if (markError) {
      setBusy(false);
      setError(markError.message);
      return;
    }
    await resolveExtras(supabase);
    setBusy(false);
    router.refresh();
  }

  // For a plain suggested_action (no stage/timeline attached) - "Add to
  // list" turns it into a task rather than mutating the contact directly,
  // since there's nothing concrete to apply, just something worth doing.
  async function handleAddToList() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: taskError } = await supabase.from("tasks").insert({
      owner_id: ownerId,
      contact_id: contactId,
      title: insight.suggested_action,
      due_at: new Date().toISOString(),
    });
    if (taskError) {
      setBusy(false);
      setError(taskError.message);
      return;
    }
    const { error: markError } = await supabase.from("ai_insights").update({ dismissed: true }).eq("id", insight.id);
    if (markError) {
      setBusy(false);
      setError(markError.message);
      return;
    }
    await resolveExtras(supabase);
    setBusy(false);
    router.refresh();
  }

  const suggestionLine = [
    suggestedStage ? `Move to ${suggestedStage.name}` : null,
    insight.suggested_timeline ? `Timeline: ${TIMELINE_LABELS[insight.suggested_timeline]}` : null,
    suggestedTags.length > 0 ? `Tag: ${suggestedTags.map((t) => t.name).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const actions = (
    <>
      {hasApplyTarget ? (
        <button
          onClick={handleApply}
          disabled={busy}
          className={cn(
            "whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 disabled:opacity-50",
            stacked ? "flex h-11 flex-1 items-center justify-center rounded-xl text-[15px]" : "px-3.5 py-2",
          )}
        >
          Apply
        </button>
      ) : insight.suggested_action ? (
        <button
          onClick={handleAddToList}
          disabled={busy}
          className={cn(
            "whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white text-sm font-semibold text-neutral-800 disabled:opacity-50",
            stacked ? "flex h-11 flex-1 items-center justify-center rounded-xl text-[15px]" : "px-3.5 py-2",
          )}
        >
          Add to list
        </button>
      ) : null}
      <button
        onClick={handleDismiss}
        disabled={busy}
        aria-label="Dismiss"
        className={cn(
          "rounded-[10px] border border-neutral-200 bg-white text-neutral-500 disabled:opacity-50",
          stacked ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" : "p-2",
        )}
      >
        <X size={stacked ? 16 : 14} />
      </button>
    </>
  );

  return (
    <div className={cn("border-b border-neutral-100 px-4 py-3.5 last:border-b-0", stacked ? "" : "flex items-center gap-3.5")}>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-6 text-neutral-900">{insight.summary}</p>
        <p className="mt-0.5 text-sm text-neutral-500">
          {showContactName && <span className="font-medium text-neutral-600">{contactName} · </span>}
          {suggestionLine || insight.suggested_action}
          {meta && <span> · {meta}</span>}
        </p>
        {error && <p className="mt-0.5 text-sm text-red-600">Couldn&apos;t apply: {error}</p>}
      </div>
      {stacked ? (
        <div className="mt-2.5 flex items-center gap-2">{actions}</div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}

      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={(representing === "buyer" || representing === "seller" ? representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={() => setDealModal(null)}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={() => setPendingCleanup(null)} />}
    </div>
  );
}
