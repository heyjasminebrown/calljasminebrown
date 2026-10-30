"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui";
import { applyStageChange, type DealModalMode, type PendingDealSummary } from "@/lib/crm/stage-transition";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import type { DealSide, PipelineStage, Representing } from "@/types/database";

export function StageSelector({
  contactId,
  ownerId,
  currentStageId,
  stages,
  contactName,
  contactCreatedAt,
  representing,
}: {
  contactId: string;
  ownerId: string;
  currentStageId: string | null;
  stages: PipelineStage[];
  contactName?: string;
  contactCreatedAt?: string;
  representing?: Representing | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentStageId ?? "");
  const [saving, setSaving] = useState(false);
  const [dealModal, setDealModal] = useState<{ id: string; mode: DealModalMode } | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<PendingDealSummary[] | null>(null);

  async function handleChange(newStageId: string) {
    const previous = value;
    setValue(newStageId);
    setSaving(true);

    const supabase = createClient();
    const oldStage = stages.find((s) => s.id === previous);
    const newStage = stages.find((s) => s.id === newStageId);

    const { error, dealId, dealMode, pendingAtRisk } = await applyStageChange(
      supabase,
      ownerId,
      contactId,
      oldStage,
      newStage,
    );

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
    } else {
      setValue(previous);
    }
    setSaving(false);
  }

  return (
    <>
      <Select value={value} disabled={saving} onChange={(e) => handleChange(e.target.value)}>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={contactName ?? "This contact"}
          defaultLeadStartedAt={contactCreatedAt ?? null}
          defaultSide={(representing === "buyer" || representing === "seller" ? representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={() => setDealModal(null)}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={() => setPendingCleanup(null)} />}
    </>
  );
}
