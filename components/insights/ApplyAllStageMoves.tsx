"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyStageChange } from "@/lib/crm/stage-transition";
import type { PipelineStage } from "@/types/database";

export type StageMoveItem = {
  contactId: string;
  currentStageId: string | null;
  targetStageId: string;
  insightId: string;
  extraInsightIds: string[];
  summary: string;
};

// Bulk version of SuggestedRow's own Apply - only offered for rows whose
// only suggestion is a stage change, so there's nothing else (a timeline,
// a tag) to apply per-row here. A deal row still gets created on a move
// into Under Contract or a Win stage (applyStageChange writes that
// regardless of the modal); the deal-details modal itself is skipped for
// a bulk action and can be filled in later from the contact page.
export function ApplyAllStageMoves({ ownerId, stages, items }: { ownerId: string; stages: PipelineStage[]; items: StageMoveItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const supabase = createClient();

    for (const item of items) {
      const oldStage = stages.find((s) => s.id === item.currentStageId);
      const newStage = stages.find((s) => s.id === item.targetStageId);
      if (!newStage) continue;

      const { error } = await applyStageChange(supabase, ownerId, item.contactId, oldStage, newStage);
      if (error) continue;

      await supabase.from("activities").insert({
        owner_id: ownerId,
        contact_id: item.contactId,
        type: "status_change",
        direction: "none",
        source: "ai",
        body: `AI-suggested update applied: ${item.summary}`,
      });

      await supabase.from("ai_insights").update({ dismissed: true, applied: true }).eq("id", item.insightId);
      if (item.extraInsightIds.length > 0) {
        await supabase.from("ai_insights").update({ dismissed: true }).in("id", item.extraInsightIds);
      }
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
    >
      {busy ? "Applying…" : `Apply all ${items.length} stage move${items.length === 1 ? "" : "s"}`}
    </button>
  );
}
