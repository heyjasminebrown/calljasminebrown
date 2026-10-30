"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { applyStageChange, type DealModalMode, type PendingDealSummary } from "@/lib/crm/stage-transition";
import type { PipelineStage } from "@/types/database";

// The stage-change sequence every entry point should share: call
// applyStageChange, log the status_change activity, then branch on
// dealMode/pendingAtRisk to pop the right modal. Extracted from
// MoveToMenu.tsx so the mobile Stage & tags sheet and the desktop
// Move to... menu can never drift into different behavior for the same
// action.
export function useApplyStageChange(ownerId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dealModal, setDealModal] = useState<{ id: string; mode: DealModalMode } | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<PendingDealSummary[] | null>(null);

  async function move(
    contactId: string,
    oldStage: PipelineStage | undefined,
    newStage: PipelineStage | undefined,
    nextFollowUpAt?: string | null,
  ): Promise<boolean> {
    setBusy(true);
    const supabase = createClient();
    const { error, dealId, dealMode, pendingAtRisk } = await applyStageChange(supabase, ownerId, contactId, oldStage, newStage, nextFollowUpAt);

    if (!error) {
      await supabase.from("activities").insert({
        owner_id: ownerId,
        contact_id: contactId,
        type: "status_change",
        direction: "none",
        source: "manual",
        body: `Stage changed from ${oldStage?.name ?? "None"} to ${newStage?.name ?? "None"}`,
      });
      if (dealId && dealMode) setDealModal({ id: dealId, mode: dealMode });
      if (pendingAtRisk) setPendingCleanup(pendingAtRisk);
      router.refresh();
    }
    setBusy(false);
    return !error;
  }

  return {
    move,
    busy,
    dealModal,
    pendingCleanup,
    clearDealModal: () => setDealModal(null),
    clearPendingCleanup: () => setPendingCleanup(null),
  };
}
