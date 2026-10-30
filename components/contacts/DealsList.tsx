"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLocal } from "@/lib/format-time";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { X, Pencil, Plus } from "lucide-react";
import type { Deal, DealSide, Representing } from "@/types/database";

// Deals are otherwise append-only by design (see stage-transition.ts) so
// a repeat closer's history survives cycling back to active - this is the
// one deliberate escape hatch, for undoing an accidental move into a Win
// stage rather than editing conversion history in general. Editing a
// deal's details (address, price, etc.) is always available since those
// are just data entry, not conversion history.
export function DealsList({
  deals,
  contactId,
  ownerId,
  contactName,
  contactCreatedAt,
  representing,
}: {
  deals: Deal[];
  contactId: string;
  ownerId: string;
  contactName: string;
  contactCreatedAt: string;
  representing: Representing | null;
}) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from("deals").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setConfirmingId(null);
    router.refresh();
  }

  const defaultSide = (representing === "buyer" || representing === "seller" ? representing : null) as
    | DealSide
    | null;
  const wonCount = deals.filter((d) => d.status === "won").length;

  return (
    <div className="mt-1.5 space-y-1">
      {deals.length > 0 && (
        <>
          <p className="text-xs font-medium text-neutral-400">
            Deals closed: {wonCount}
            {deals.length > wonCount && ` (+${deals.length - wonCount} pending)`}
          </p>
          <ul className="space-y-0.5">
            {deals.map((deal) => (
              <li key={deal.id} className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="min-w-0 flex-1 truncate">
                  {deal.status === "pending" && <span className="font-medium text-amber-600">Pending · </span>}
                  {formatLocal(deal.closed_at, "MMM d, yyyy")}
                  {deal.address && ` · ${deal.address}`}
                </span>
                {confirmingId === deal.id ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-neutral-400">{deleteError ? `Couldn't remove: ${deleteError}` : "Remove this deal?"}</span>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      disabled={deletingId === deal.id}
                      className="font-medium text-red-600 hover:underline"
                    >
                      {deletingId === deal.id ? "Removing…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingId(null);
                        setDeleteError(null);
                      }}
                      className="text-neutral-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEditingDeal(deal)}
                      className="text-neutral-300 hover:text-brand-600"
                      title="Edit this deal"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setConfirmingId(deal.id)}
                      className="text-neutral-300 hover:text-red-500"
                      title="Remove this deal"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      >
        <Plus size={12} /> {deals.length > 0 ? "Add another deal" : "Add a deal"}
      </button>

      {editingDeal && (
        <DealCelebrationModal
          dealId={editingDeal.id}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={defaultSide}
          initial={editingDeal}
          mode="edit"
          onClose={() => setEditingDeal(null)}
        />
      )}
      {adding && (
        <DealCelebrationModal
          contactId={contactId}
          ownerId={ownerId}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={defaultSide}
          mode="create"
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
