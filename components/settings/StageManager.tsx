"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select } from "@/components/ui";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { PipelineStage } from "@/types/database";

function isClosed(stage: PipelineStage) {
  return stage.is_closed_won || stage.is_closed_lost;
}

function statusOf(stage: PipelineStage): "active" | "closed" | "trash" {
  if (stage.is_trash) return "trash";
  if (isClosed(stage)) return "closed";
  return "active";
}

export function StageManager({ stages, ownerId, stageCounts }: { stages: PipelineStage[]; ownerId: string; stageCounts?: Record<string, number> }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function updateStage(id: string, patch: Partial<PipelineStage>) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("pipeline_stages").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function deleteStage(id: string) {
    if (!confirm("Delete this stage? Contacts in it will be unassigned.")) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("pipeline_stages").delete().eq("id", id);
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
      supabase.from("pipeline_stages").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("pipeline_stages").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    const moveError = results.find((r) => r.error)?.error;
    if (moveError) {
      setError(moveError.message);
      return;
    }
    router.refresh();
  }

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("pipeline_stages").insert({
      owner_id: ownerId,
      name: newName.trim(),
      sort_order: (sorted.at(-1)?.sort_order ?? 0) + 1,
      color: "#94a3b8",
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewName("");
    router.refresh();
  }

  // Main control is Active / Closed / Trash. Closed defaults to "lost"
  // until explicitly marked a win - the won/lost distinction only matters
  // for the conversion-rate metric, so it's a secondary, only-shown-when-
  // closed checkbox rather than a 4-way choice up front. Trash is its own
  // status (not a flavor of Closed) since it means "not a real lead" and
  // archives the contact rather than tracking a relationship outcome.
  async function setStatus(stage: PipelineStage, status: "active" | "closed" | "trash") {
    if (status === "active") {
      await updateStage(stage.id, { is_closed_won: false, is_closed_lost: false, is_trash: false });
    } else if (status === "closed") {
      // Under Contract doesn't apply once a stage means the relationship
      // is done, so it's cleared along with the active-only checkbox.
      await updateStage(stage.id, { is_closed_lost: true, is_closed_won: false, is_trash: false, is_under_contract: false });
    } else {
      await updateStage(stage.id, { is_trash: true, is_closed_won: false, is_closed_lost: false, is_under_contract: false });
    }
  }

  async function setWon(stage: PipelineStage, won: boolean) {
    await updateStage(stage.id, { is_closed_won: won, is_closed_lost: !won });
  }

  async function setUnderContract(stage: PipelineStage, value: boolean) {
    await updateStage(stage.id, { is_under_contract: value });
  }

  return (
    <div>
      <p className="text-[16px] font-semibold text-neutral-900">Pipeline stages</p>
      <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-500">
        &quot;Active&quot; vs &quot;Closed&quot; controls who counts as an active lead on your dashboard and in
        metrics — mark any stage that means the relationship is done as Closed. &quot;Trash&quot; is for
        contacts who were never a real lead (spam, wrong number) — moving a contact into a Trash stage
        archives them and removes them from metrics entirely. Flag one active stage as &quot;Under Contract&quot;
        to get a details prompt (address, price, etc.) the moment a deal goes pending, before it actually closes.
      </p>
      {error && <p className="mt-2 text-[15px] font-medium text-red-600">Couldn&apos;t save: {error}</p>}
      <div className="mt-3 space-y-2.5">
        {sorted.map((stage, i) => (
          <div key={stage.id} className="flex flex-wrap items-center gap-2.5 border-b border-neutral-100 pb-2.5 last:border-b-0 last:pb-0">
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStage(stage.id, { color: e.target.value })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-neutral-200"
            />
            <Input
              defaultValue={stage.name}
              onBlur={(e) => e.target.value !== stage.name && updateStage(stage.id, { name: e.target.value })}
              className="min-w-[7rem] flex-1 font-medium"
            />
            {stageCounts && (
              <span className="shrink-0 text-[15px] text-neutral-500">
                {stageCounts[stage.id] ?? 0} {(stageCounts[stage.id] ?? 0) === 1 ? "person" : "people"}
              </span>
            )}
            <Select
              value={statusOf(stage)}
              onChange={(e) => setStatus(stage, e.target.value as "active" | "closed" | "trash")}
              className="w-auto shrink-0 text-[15px]"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="trash">Trash</option>
            </Select>
            {isClosed(stage) && (
              <label className="flex shrink-0 items-center gap-1.5 text-[15px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={stage.is_closed_won}
                  onChange={(e) => setWon(stage, e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Win
              </label>
            )}
            {statusOf(stage) === "active" && (
              <label className="flex shrink-0 items-center gap-1.5 text-[15px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={stage.is_under_contract}
                  onChange={(e) => setUnderContract(stage, e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Under Contract
              </label>
            )}
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
            <button onClick={() => deleteStage(stage.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={addStage} className="mt-3 flex gap-2">
        <Input placeholder="New stage name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" size="sm" disabled={saving}>
          <Plus size={15} /> Add
        </Button>
      </form>
    </div>
  );
}
