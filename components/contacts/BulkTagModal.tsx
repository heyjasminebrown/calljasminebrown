"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Select } from "@/components/ui";
import { X } from "lucide-react";
import type { Tag } from "@/types/database";

export function BulkTagModal({
  mode,
  tags,
  contactIds,
  onClose,
  onDone,
}: {
  mode: "add" | "remove";
  tags: Tag[];
  contactIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!tagId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: applyError } =
      mode === "add"
        ? await supabase.from("contact_tags").upsert(
            contactIds.map((contact_id) => ({ contact_id, tag_id: tagId })),
            { onConflict: "contact_id,tag_id" },
          )
        : await supabase.from("contact_tags").delete().eq("tag_id", tagId).in("contact_id", contactIds);
    setSaving(false);
    if (applyError) {
      setError(applyError.message);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">{mode === "add" ? "Add tag" : "Remove tag"}</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "add" ? "Adding to" : "Removing from"} {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}.
          {mode === "add" && " Anyone newly getting the tag also joins any drip sequence targeting it, same as adding it one at a time."}
        </p>
        <div className="mt-4">
          {tags.length === 0 ? (
            <p className="text-sm text-neutral-400">No tags yet — create one in Settings first.</p>
          ) : (
            <Select value={tagId} onChange={(e) => setTagId(e.target.value)}>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
        <div className="mt-5 flex gap-3">
          <Button onClick={apply} disabled={saving || !tagId} className="flex-1">
            {saving ? "Saving…" : mode === "add" ? "Add tag" : "Remove tag"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
