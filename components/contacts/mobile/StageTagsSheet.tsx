"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApplyStageChange } from "@/lib/hooks/useApplyStageChange";
import { BottomSheet } from "@/components/mobile/BottomSheet";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DealSide, PipelineStage, Representing, Tag } from "@/types/database";

const FOLLOW_UP_OPTIONS: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

function stageFlags(stage: PipelineStage): string | null {
  const flags = [
    stage.is_under_contract && "opens a deal",
    stage.is_closed_won && "win",
    (stage.is_closed_won || stage.is_closed_lost) && "closed",
    stage.is_trash && "archives them",
  ].filter(Boolean);
  return flags.length ? flags.join(" · ") : null;
}

export function StageTagsSheet({
  open,
  onClose,
  contactId,
  ownerId,
  currentStageId,
  stages,
  tags,
  currentTagIds,
  contactName,
  contactCreatedAt,
  representing,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  ownerId: string;
  currentStageId: string | null;
  stages: PipelineStage[];
  tags: Tag[];
  currentTagIds: string[];
  contactName: string;
  contactCreatedAt: string;
  representing: Representing | null;
}) {
  const router = useRouter();
  const { move, busy, dealModal, pendingCleanup, clearDealModal, clearPendingCleanup } = useApplyStageChange(ownerId);
  const [stageId, setStageId] = useState(currentStageId);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStageId(currentStageId);
      setSelectedTagIds(currentTagIds);
      setAddingTag(false);
      setNewTagName("");
      setFollowUpDays(null);
      setSaveError(null);
    }
    wasOpen.current = open;
  }, [open, currentStageId, currentTagIds]);

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function addTag() {
    if (!newTagName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("tags").insert({ owner_id: ownerId, name: newTagName.trim(), color: "#94a3b8" }).select("id").single();
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSelectedTagIds((prev) => [...prev, data.id]);
    setNewTagName("");
    setAddingTag(false);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    const nextFollowUpAt = followUpDays ? new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toISOString() : undefined;
    if (stageId !== currentStageId || nextFollowUpAt) {
      const oldStage = stages.find((s) => s.id === currentStageId);
      const newStage = stages.find((s) => s.id === stageId);
      const ok = await move(contactId, oldStage, newStage, nextFollowUpAt);
      if (!ok) {
        setSaving(false);
        setSaveError("Couldn't change stage - try again.");
        return;
      }
    }

    const { error: tagDeleteError } = await supabase.from("contact_tags").delete().eq("contact_id", contactId);
    if (tagDeleteError) {
      setSaving(false);
      setSaveError(`Stage saved, but tags couldn't update: ${tagDeleteError.message}`);
      return;
    }
    if (selectedTagIds.length > 0) {
      const { error: tagInsertError } = await supabase.from("contact_tags").insert(selectedTagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId })));
      if (tagInsertError) {
        setSaving(false);
        setSaveError(`Stage saved, but tags couldn't update: ${tagInsertError.message}`);
        return;
      }
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Stage & tags"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className="!px-4">
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || busy} className="flex-1">
              {saving || busy ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 pb-4">
          {saveError && <p className="text-[14px] font-medium text-red-600">{saveError}</p>}
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Stage</p>
            <div className="divide-y divide-neutral-100 rounded-[14px] border border-neutral-200">
              {stages.map((stage) => {
                const current = stage.id === stageId;
                const flags = stageFlags(stage);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setStageId(stage.id)}
                    className={cn("flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left", current && "bg-brand-50")}
                  >
                    <span>
                      <span className={cn("block text-[16px] font-medium", current ? "text-brand-700" : "text-neutral-900")}>{stage.name}</span>
                      {flags && <span className="text-[13px] text-neutral-400">{flags}</span>}
                    </span>
                    {current && (
                      <span className="flex items-center gap-1 text-[13px] font-semibold text-brand-700">
                        <Check size={15} /> current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn("flex h-[45px] items-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium", active ? "border-transparent text-white" : "border-neutral-200 text-neutral-600")}
                    style={active ? { backgroundColor: tag.color } : undefined}
                  >
                    {active && <Check size={15} />}
                    {tag.name}
                  </button>
                );
              })}
              {addingTag ? (
                <div className="flex h-[45px] items-center gap-1.5">
                  <Input
                    autoFocus
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag name"
                    className="!h-[45px] w-32 !py-0"
                  />
                  <button type="button" onClick={addTag} className="text-[14px] font-semibold text-brand-600">
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTag(true)}
                  className="flex h-[45px] items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3.5 text-[15px] font-medium text-neutral-500"
                >
                  <Plus size={15} /> New tag
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Then follow up</p>
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setFollowUpDays(followUpDays === opt.days ? null : opt.days)}
                  className={cn(
                    "h-11 rounded-full px-3.5 text-[14px] font-medium",
                    followUpDays === opt.days ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>

      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={(representing === "buyer" || representing === "seller" ? representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={clearDealModal}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={clearPendingCleanup} />}
    </>
  );
}
