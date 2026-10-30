"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { LEAD_SOURCES } from "@/lib/utils";
import { X } from "lucide-react";

export function BulkLeadSourceModal({
  contactIds,
  onClose,
  onDone,
}: {
  contactIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (!source.trim()) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ lead_source: source.trim() }).in("id", contactIds);
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Change lead source</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Setting the lead source for {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}.
        </p>
        <div className="mt-4">
          <Input list="bulk-lead-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Referral" />
          <datalist id="bulk-lead-sources">
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="mt-5 flex gap-3">
          <Button onClick={apply} disabled={saving || !source.trim()} className="flex-1">
            {saving ? "Saving…" : "Change source"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
