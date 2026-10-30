"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { applyStageChange, type PendingDealSummary } from "@/lib/crm/stage-transition";
import { Button, Select } from "@/components/ui";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import { X } from "lucide-react";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

export function BulkStageModal({
  contacts,
  stages,
  ownerId,
  onClose,
  onDone,
}: {
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  ownerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  // A single-contact move surfaces PendingDealCleanupModal when it leaves
  // Under Contract without closing (see MoveToMenu/useApplyStageChange) -
  // the bulk loop below used to just discard that same signal per contact,
  // so moving several people off Under Contract at once could silently
  // leave orphaned "pending" deal rows with no warning at all. Collected
  // across every contact in the loop and shown once, after it finishes.
  const [pendingCleanup, setPendingCleanup] = useState<PendingDealSummary[] | null>(null);

  const newStage = stages.find((s) => s.id === stageId);
  // Same side effects as changing one contact's stage by hand (archiving
  // into Trash, opening a deal record on Won/Under Contract) - counted here
  // just to warn upfront, since popping a detail modal per contact for a
  // bulk action would be unusable.
  const dealCount = newStage
    ? contacts.filter(
        (c) =>
          (newStage.is_closed_won && !c.pipeline_stages?.is_closed_won) ||
          (newStage.is_under_contract && !c.pipeline_stages?.is_under_contract),
      ).length
    : 0;

  async function apply() {
    if (!stageId || !newStage) return;
    setSaving(true);
    setProgress(0);
    const supabase = createClient();
    const atRisk: PendingDealSummary[] = [];

    for (const contact of contacts) {
      const oldStage = contact.pipeline_stages ?? undefined;
      const { error, pendingAtRisk } = await applyStageChange(supabase, ownerId, contact.id, oldStage, newStage);
      if (!error) {
        await supabase.from("activities").insert({
          owner_id: ownerId,
          contact_id: contact.id,
          type: "status_change",
          direction: "none",
          source: "manual",
          body: `Stage changed from ${oldStage?.name ?? "None"} to ${newStage.name}`,
        });
        if (pendingAtRisk) atRisk.push(...pendingAtRisk);
      }
      setProgress((p) => p + 1);
    }

    setSaving(false);
    if (atRisk.length > 0) setPendingCleanup(atRisk);
    else onDone();
  }

  if (pendingCleanup) {
    return <PendingDealCleanupModal deals={pendingCleanup} onClose={onDone} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Change stage</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Moving {contacts.length} contact{contacts.length === 1 ? "" : "s"} to a new stage.
        </p>
        <div className="mt-4">
          {stages.length === 0 ? (
            <p className="text-sm text-neutral-400">No stages yet — create one in Settings first.</p>
          ) : (
            <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        {dealCount > 0 && (
          <p className="mt-3 text-xs text-amber-600">
            {dealCount} of these will get a new {newStage?.is_closed_won ? "Won" : "Under Contract"} deal record with no
            price/address yet — fill those in later from each contact&apos;s deal.
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <Button onClick={apply} disabled={saving || !stageId} className="flex-1">
            {saving ? `Updating ${progress}/${contacts.length}…` : "Change stage"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
