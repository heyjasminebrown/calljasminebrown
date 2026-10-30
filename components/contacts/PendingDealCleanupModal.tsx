"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { X } from "lucide-react";
import type { PendingDealSummary } from "@/lib/crm/stage-transition";

// Shown when a contact's stage moves off Under Contract without closing.
// Never deletes anything on its own - only what the agent explicitly
// checks here gets removed, since a contact can have more than one deal
// in flight (a Buy/Sell client under contract on both sides) and the
// stage change alone can't say which one, if any, actually fell through.
export function PendingDealCleanupModal({
  deals,
  onClose,
}: {
  deals: PendingDealSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setSaving(true);
    const supabase = createClient();
    await supabase.from("deals").delete().in("id", [...selected]);
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-xl font-semibold text-neutral-900">Still under contract</p>
            <p className="mt-0.5 text-sm text-neutral-500">
              This contact moved off an Under Contract stage but still has {deals.length === 1 ? "a deal" : `${deals.length} deals`} marked pending. Check any that actually fell through to remove them — leave the rest unchecked to keep tracking them.
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {deals.map((deal) => (
            <label
              key={deal.id}
              className="flex items-center gap-2.5 rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700"
            >
              <input
                type="checkbox"
                checked={selected.has(deal.id)}
                onChange={() => toggle(deal.id)}
                className="h-4 w-4 shrink-0 rounded border-neutral-300"
              />
              <span className="min-w-0 truncate">{deal.address || deal.client_name || "Untitled deal"}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <Button onClick={handleConfirm} disabled={saving} className="flex-1">
            {saving ? "Updating…" : selected.size > 0 ? `Remove ${selected.size} deal${selected.size === 1 ? "" : "s"}` : "Keep all"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
