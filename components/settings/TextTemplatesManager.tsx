"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Textarea } from "@/components/ui";
import { ArrowUp, ArrowDown, Trash2, Plus, Star } from "lucide-react";
import type { TextTemplate } from "@/types/database";

// Same direct supabase.from CRUD + swap-two-rows reorder pattern as
// StageManager.tsx - no server actions file needed for plain settings
// CRUD like this, matching the rest of Settings' existing managers.
export function TextTemplatesManager({ templates, ownerId }: { templates: TextTemplate[]; ownerId: string }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...templates].sort((a, b) => a.sort_order - b.sort_order);

  async function updateTemplate(id: string, patch: Partial<TextTemplate>) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("text_templates").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("text_templates").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = sorted[index + direction];
    const current = sorted[index];
    if (!target) return;
    setError(null);
    const supabase = createClient();
    const results = await Promise.all([
      supabase.from("text_templates").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("text_templates").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    const moveError = results.find((r) => r.error)?.error;
    if (moveError) {
      setError(moveError.message);
      return;
    }
    router.refresh();
  }

  // Unchecks the old default client-side before writing the new one -
  // the DB's partial unique index is the real guarantee, this just
  // avoids a round-trip that briefly violates it.
  async function setDefault(id: string) {
    setError(null);
    const supabase = createClient();
    const previous = sorted.find((t) => t.is_default_draft);
    if (previous && previous.id !== id) {
      const { error: clearError } = await supabase.from("text_templates").update({ is_default_draft: false }).eq("id", previous.id);
      if (clearError) {
        setError(clearError.message);
        return;
      }
    }
    const { error: defaultError } = await supabase.from("text_templates").update({ is_default_draft: true }).eq("id", id);
    if (defaultError) {
      setError(defaultError.message);
      return;
    }
    router.refresh();
  }

  async function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newBody.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("text_templates").insert({
      owner_id: ownerId,
      label: newLabel.trim(),
      body: newBody.trim(),
      sort_order: (sorted.at(-1)?.sort_order ?? 0) + 1,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewLabel("");
    setNewBody("");
    router.refresh();
  }

  return (
    <div>
      <p className="text-[16px] font-semibold text-neutral-900">Quick texts</p>
      <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-500">
        Short saved messages you can send with one tap from a contact or a text thread. Use{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-[13px]">{"{{first_name}}"}</code> to merge in their name. The starred one
        is what Today drafts for your top follow-up automatically.
      </p>
      {error && <p className="mt-2 text-[15px] font-medium text-red-600">Couldn&apos;t save: {error}</p>}
      <div className="mt-3 space-y-2.5">
        {sorted.map((template, i) => (
          <div key={template.id} className="flex flex-wrap items-start gap-2.5 border-b border-neutral-100 pb-2.5 last:border-b-0 last:pb-0">
            <button
              type="button"
              onClick={() => setDefault(template.id)}
              title={template.is_default_draft ? "Default draft" : "Set as default draft"}
              className={
                template.is_default_draft
                  ? "mt-2 shrink-0 rounded-lg p-2 text-amber-500"
                  : "mt-2 shrink-0 rounded-lg p-2 text-neutral-300 hover:text-neutral-400"
              }
            >
              <Star size={16} fill={template.is_default_draft ? "currentColor" : "none"} />
            </button>
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Input
                defaultValue={template.label}
                onBlur={(e) => e.target.value !== template.label && updateTemplate(template.id, { label: e.target.value })}
                className="font-medium"
              />
              <Textarea
                defaultValue={template.body}
                onBlur={(e) => e.target.value !== template.body && updateTemplate(template.id, { body: e.target.value })}
                rows={2}
                className="text-[15px]"
              />
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === sorted.length - 1}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button onClick={() => deleteTemplate(template.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-[15px] text-neutral-400">No saved templates yet.</p>}
      </div>
      <form onSubmit={addTemplate} className="mt-3 space-y-2">
        <Input placeholder="Label, e.g. Checking in" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <Textarea
          placeholder="Hey {{first_name}}, just checking in..."
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={2}
        />
        <Button type="submit" size="sm" disabled={saving}>
          <Plus size={15} /> Add template
        </Button>
      </form>
    </div>
  );
}
