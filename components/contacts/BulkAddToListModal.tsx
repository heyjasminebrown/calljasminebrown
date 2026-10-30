"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select } from "@/components/ui";
import { mergeIncludeIds } from "@/lib/crm/contact-filter-params";
import { partitionLists } from "@/lib/crm/smart-lists";
import type { ContactSegment } from "@/types/database";

export function BulkAddToListModal({
  contactIds,
  segments,
  ownerId,
  onClose,
  onDone,
}: {
  contactIds: string[];
  segments: ContactSegment[];
  ownerId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const staticLists = partitionLists(segments).staticLists;
  const [mode, setMode] = useState<"existing" | "new">(staticLists.length > 0 ? "existing" : "new");
  const [segmentId, setSegmentId] = useState(staticLists[0]?.id ?? "");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    if (mode === "new") {
      if (!name.trim()) {
        setSaving(false);
        setError("Name this list first.");
        return;
      }
      const { error: insertError } = await supabase.from("contact_segments").insert({
        owner_id: ownerId,
        name: name.trim(),
        filters: { ids: contactIds.join(",") },
      });
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
      onDone();
      router.refresh();
      return;
    }
    const segment = staticLists.find((s) => s.id === segmentId);
    if (!segment) {
      setSaving(false);
      setError("Pick a list.");
      return;
    }
    const filters = { ...(segment.filters as Record<string, string>) };
    filters.ids = mergeIncludeIds(filters.ids, contactIds);
    const { error: updateError } = await supabase.from("contact_segments").update({ filters }).eq("id", segment.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Add to list</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {contactIds.length} contact{contactIds.length === 1 ? "" : "s"} — saved lists stay inside Contacts, not a
          separate nav item.
        </p>
        <div className="mt-4 space-y-3">
          {staticLists.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${mode === "existing" ? "bg-[#f3e4dc] text-[#c45c4a]" : "bg-neutral-100 text-neutral-600"}`}
              >
                Existing list
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${mode === "new" ? "bg-[#f3e4dc] text-[#c45c4a]" : "bg-neutral-100 text-neutral-600"}`}
              >
                New list
              </button>
            </div>
          )}
          {mode === "existing" ? (
            <Select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              {staticLists.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={() => void apply()} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Add to list"}
          </Button>
        </div>
      </div>
    </div>
  );
}
