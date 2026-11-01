"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Select } from "@/components/ui";
import { RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS } from "@/lib/utils";
import type { RelationshipType } from "@/types/database";
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
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("community");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({ relationship_type: relationshipType }).in("id", contactIds);
    setSaving(false);
    if (error) {
      setError(`Couldn't change type: ${error.message}`);
      return;
    }
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
          Setting the type for {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}.
        </p>
        <div className="mt-4">
          <Select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}>
            {RELATIONSHIP_TYPES.map((value) => (
              <option key={value} value={value}>
                {RELATIONSHIP_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
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
