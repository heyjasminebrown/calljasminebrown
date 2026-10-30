"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Select } from "@/components/ui";
import { CONTACT_TYPE_LABELS } from "@/lib/utils";
import { X } from "lucide-react";

export function BulkTypeModal({
  contactIds,
  onClose,
  onDone,
}: {
  contactIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [contactType, setContactType] = useState("buyer");
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("contacts").update({ contact_type: contactType }).in("id", contactIds);
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Change type</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Setting the contact type for {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}.
        </p>
        <div className="mt-4">
          <Select value={contactType} onChange={(e) => setContactType(e.target.value)}>
            {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-5 flex gap-3">
          <Button onClick={apply} disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Change type"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
