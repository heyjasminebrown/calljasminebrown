"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { Check, X } from "lucide-react";
import { cn, TAG_CHIP_SELECTED } from "@/lib/utils";
import type { Tag } from "@/types/database";

const BATCH = 100;

export function BulkTagModal({
  mode,
  tags: initialTags,
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
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setTagIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
      setNewTagName("");
      setCreating(false);
      return;
    }
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired - sign in again.");
      return;
    }
    const { data, error: insertError } = await supabase.from("tags").insert({ owner_id: user.id, name, color: "#94a3b8" }).select("*").single();
    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't create the tag");
      return;
    }
    setTags((prev) => [...prev, data as Tag].sort((a, b) => a.name.localeCompare(b.name)));
    setTagIds((prev) => [...prev, (data as Tag).id]);
    setNewTagName("");
    setCreating(false);
  }

  async function apply() {
    if (tagIds.length === 0) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    // Batches keep each request small for big selections.
    for (let i = 0; i < contactIds.length; i += BATCH) {
      const chunk = contactIds.slice(i, i + BATCH);
      const { error: applyError } =
        mode === "add"
          ? await supabase.from("contact_tags").upsert(
              chunk.flatMap((contact_id) => tagIds.map((tag_id) => ({ contact_id, tag_id }))),
              { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
            )
          : await supabase.from("contact_tags").delete().in("tag_id", tagIds).in("contact_id", chunk);
      if (applyError) {
        setSaving(false);
        setError(`${applyError.message}${i > 0 ? ` (the first ${i} contacts were updated)` : ""}`);
        return;
      }
    }
    setSaving(false);
    onDone();
  }

  const label = mode === "add" ? (tagIds.length > 1 ? `Add ${tagIds.length} tags` : "Add tag") : tagIds.length > 1 ? `Remove ${tagIds.length} tags` : "Remove tag";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">{mode === "add" ? "Add tags" : "Remove tags"}</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {mode === "add" ? "Adding to" : "Removing from"} {contactIds.length} contact{contactIds.length === 1 ? "" : "s"}. Tap to pick one or more.
          {mode === "add" && " Anyone newly getting a tag also joins any campaign that starts on it, same as adding it one at a time."}
        </p>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                    on ? `border-transparent ${TAG_CHIP_SELECTED}` : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {on && <Check size={14} />}
                  {t.name}
                </button>
              );
            })}
            {mode === "add" && !creating && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-500"
              >
                + New tag
              </button>
            )}
            {mode === "remove" && tags.length === 0 && <p className="text-sm text-neutral-400">No tags yet.</p>}
          </div>
          {creating && (
            <div className="mt-3 flex gap-2">
              <Input
                autoFocus
                placeholder="New tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createTag();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={createTag} disabled={!newTagName.trim()}>
                Create
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
        <div className="mt-5 flex gap-3">
          <Button onClick={apply} disabled={saving || tagIds.length === 0} className="flex-1">
            {saving ? "Saving…" : label}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
