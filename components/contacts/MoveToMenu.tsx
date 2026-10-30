"use client";

import { useState } from "react";
import { useApplyStageChange } from "@/lib/hooks/useApplyStageChange";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import type { DealSide, PipelineStage, Representing } from "@/types/database";

// The Move to... menu is the only way to change a contact's stage from
// Pipeline now that the per-card <select> is gone (drag-and-drop was
// scoped out of this pass - deliberately, not an oversight). Calls the
// same applyStageChange every other stage-change entry point uses, so
// deal side effects (pending-deal creation, the win celebration, the
// at-risk warning on leaving Under Contract) stay identical regardless
// of which UI triggered the move.
export function MoveToMenu({
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
  contactName: string;
  contactCreatedAt: string;
  representing: Representing | null;
}) {
  const [open, setOpen] = useState(false);
  const { move: applyMove, busy, dealModal, pendingCleanup, clearDealModal, clearPendingCleanup } = useApplyStageChange(ownerId);

  async function move(newStageId: string) {
    setOpen(false);
    const oldStage = stages.find((s) => s.id === currentStageId);
    const newStage = stages.find((s) => s.id === newStageId);
    await applyMove(contactId, oldStage, newStage);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={busy}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
      >
        {busy ? "Moving…" : "Move to…"}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 top-full z-40 mt-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            {stages
              .filter((s) => s.id !== currentStageId)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    move(s.id);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  {s.name}
                </button>
              ))}
          </div>
        </>
      )}

      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={(representing === "buyer" || representing === "seller" ? representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={clearDealModal}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={clearPendingCleanup} />}
    </div>
  );
}
