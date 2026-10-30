"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { duplicateSequence } from "@/app/(app)/sequences/actions";
import { Button, Input, Textarea, Card, Label } from "@/components/ui";
import { AudiencePicker, type AudienceCriteria } from "@/components/sequences/AudiencePicker";
import { Settings, Copy, X } from "lucide-react";
import type { Tag, PipelineStage } from "@/types/database";

export function SequenceSettingsPanel({
  sequenceId,
  ownerId,
  type,
  name,
  description,
  targetTagIds,
  excludeTagIds,
  excludeStageIds,
  excludeTimelines,
  tags,
  stages,
}: {
  sequenceId: string;
  ownerId: string;
  type: "broadcast" | "drip" | "batch";
  name: string;
  description: string | null;
  targetTagIds: string[];
  excludeTagIds: string[];
  excludeStageIds: string[];
  excludeTimelines: string[];
  tags: Tag[];
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState<AudienceCriteria>({ targetTagIds, excludeTagIds, excludeStageIds, excludeTimelines });
  const [duplicating, setDuplicating] = useState(false);

  async function saveField(patch: Record<string, unknown>) {
    const supabase = createClient();
    await supabase.from("email_sequences").update(patch).eq("id", sequenceId);
    router.refresh();
  }

  async function handleCriteriaChange(next: AudienceCriteria) {
    setCriteria(next);
    await saveField({
      target_tag_ids: next.targetTagIds,
      exclude_tag_ids: next.excludeTagIds,
      exclude_stage_ids: next.excludeStageIds,
      exclude_timelines: next.excludeTimelines,
      // A batch's frozen audience was captured under the OLD tags - clear
      // it so the next send re-freezes off the tags she just picked,
      // instead of quietly still going out to the original snapshot.
      ...(type === "batch" ? { snapshot_contact_ids: null } : {}),
    });
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const result = await duplicateSequence(sequenceId);
    setDuplicating(false);
    if (result.ok) router.push(`/sequences/${result.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"
        aria-label="Sequence settings"
      >
        <Settings size={18} />
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">Settings</h2>
        <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100">
          <X size={16} />
        </button>
      </div>
      <div>
        <Label htmlFor="seq-settings-name">Name</Label>
        <Input
          id="seq-settings-name"
          defaultValue={name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== name && saveField({ name: e.target.value.trim() })}
        />
      </div>
      <div>
        <Label htmlFor="seq-settings-desc">Notes (only you see this)</Label>
        <Textarea
          id="seq-settings-desc"
          rows={2}
          defaultValue={description ?? ""}
          placeholder="What this sequence is for, strategy notes, etc."
          onBlur={(e) => e.target.value !== (description ?? "") && saveField({ description: e.target.value || null })}
        />
      </div>
      <div>
        <AudiencePicker
          criteria={criteria}
          onChange={handleCriteriaChange}
          tags={tags}
          stages={stages}
          ownerId={ownerId}
          onTagCreated={() => router.refresh()}
        />
        <p className="mt-1 text-xs text-neutral-400">Changing this changes who gets future sends — it doesn&apos;t move anyone already enrolled.</p>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={handleDuplicate} disabled={duplicating}>
        <Copy size={14} /> {duplicating ? "Duplicating…" : "Duplicate as a new sequence"}
      </Button>
    </Card>
  );
}
