"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { previewEmailAudience, type AudiencePreview } from "@/app/(app)/sequences/actions";
import { Label, Input, Button } from "@/components/ui";
import { cn, TIMELINE_LABELS } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Tag, PipelineStage } from "@/types/database";

export type AudienceCriteria = {
  targetTagIds: string[];
  excludeTagIds: string[];
  excludeStageIds: string[];
  excludeTimelines: string[];
};

const TIMELINE_OPTIONS = Object.entries(TIMELINE_LABELS);

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Shared by CreateSequenceForm (new sequence/batch email) and
// SequenceSettingsPanel (editing an existing one's audience) so the two
// never drift into different targeting logic. "Send to" is any-of-these-
// tags (same pill-toggle convention as ContactFiltersSheet's "Tags (any
// of)"); exclusions are collapsed by default since most sends won't need
// them. The live count below debounces on every change and calls the
// exact same resolver the actual send uses, so what she sees here is who
// actually gets it - not an approximation.
export function AudiencePicker({
  criteria,
  onChange,
  tags,
  stages,
  ownerId,
  onTagCreated,
  onAudienceChange,
  excludeContactIds = [],
}: {
  criteria: AudienceCriteria;
  onChange: (next: AudienceCriteria) => void;
  tags: Tag[];
  stages: PipelineStage[];
  ownerId: string;
  // Parent owns refetching the tags list (router.refresh()) after a new
  // tag is created here, so the `tags` prop catches up.
  onTagCreated?: (tagId: string) => void;
  // Lets a parent that actually sends (CreateSequenceForm's batch type)
  // block submit on a 0-recipient audience and show the real count in a
  // send confirmation - without this, only the visual preview below knew
  // the count, so a tag selection resolving to nobody could still be
  // submitted.
  onAudienceChange?: (audience: AudiencePreview | null) => void;
  // Batch composer only: contact ids already ruled out (recent-email skip,
  // overlap with another send) - folded into the live count so what she
  // sees here matches what actually gets created.
  excludeContactIds?: string[];
}) {
  const [showExcludes, setShowExcludes] = useState(
    criteria.excludeTagIds.length > 0 || criteria.excludeStageIds.length > 0 || criteria.excludeTimelines.length > 0,
  );
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTagSaving, setCreatingTagSaving] = useState(false);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [loading, setLoading] = useState(false);

  const targetKey = criteria.targetTagIds.join(",");
  const excludeTagKey = criteria.excludeTagIds.join(",");
  const excludeStageKey = criteria.excludeStageIds.join(",");
  const excludeTimelineKey = criteria.excludeTimelines.join(",");
  const excludeContactKey = excludeContactIds.join(",");

  useEffect(() => {
    if (criteria.targetTagIds.length === 0) {
      setAudience(null);
      onAudienceChange?.(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const result = await previewEmailAudience(criteria, excludeContactIds);
      setAudience(result);
      onAudienceChange?.(result);
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the *Key strings below are the real, flattened dependency
  }, [targetKey, excludeTagKey, excludeStageKey, excludeTimelineKey, excludeContactKey]);

  async function createTag() {
    if (!newTagName.trim()) return;
    setCreatingTagSaving(true);
    const supabase = createClient();
    const { data } = await supabase.from("tags").insert({ owner_id: ownerId, name: newTagName.trim(), color: "#94a3b8" }).select("id").single();
    setCreatingTagSaving(false);
    if (data) {
      onChange({ ...criteria, targetTagIds: [...criteria.targetTagIds, data.id] });
      onTagCreated?.(data.id);
    }
    setNewTagName("");
    setCreatingTag(false);
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>Send to (any of these tags)</Label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ ...criteria, targetTagIds: toggle(criteria.targetTagIds, t.id) })}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium",
                criteria.targetTagIds.includes(t.id) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-neutral-200 text-neutral-600",
              )}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreatingTag(true)}
            className="flex h-8 items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 text-xs font-medium text-neutral-500"
          >
            <Plus size={12} /> New tag
          </button>
        </div>
        {creatingTag && (
          <div className="mt-1.5 flex gap-1.5">
            <Input autoFocus placeholder="New tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
            <Button type="button" size="sm" onClick={createTag} disabled={creatingTagSaving}>
              Add
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setCreatingTag(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {criteria.targetTagIds.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          {loading ? (
            "Checking audience…"
          ) : audience ? (
            <>
              <p className="font-semibold text-neutral-800">
                {audience.count} {audience.count === 1 ? "person" : "people"} will get this
                {(audience.excludedCount > 0 || audience.optedOutCount > 0 || audience.noEmailCount > 0) &&
                  ` (${audience.excludedCount + audience.optedOutCount + audience.noEmailCount} filtered out)`}
              </p>
              {audience.names.length > 0 && (
                <p className="mt-1 leading-relaxed">
                  {audience.names.join(", ")}
                  {audience.count > audience.names.length && ` +${audience.count - audience.names.length} more`}
                </p>
              )}
              {(audience.optedOutCount > 0 || audience.noEmailCount > 0) && (
                <p className="mt-1 text-neutral-400">
                  {audience.optedOutCount > 0 && `${audience.optedOutCount} opted out`}
                  {audience.optedOutCount > 0 && audience.noEmailCount > 0 && " · "}
                  {audience.noEmailCount > 0 && `${audience.noEmailCount} no email on file`}
                </p>
              )}
            </>
          ) : null}
        </div>
      )}

      <button type="button" onClick={() => setShowExcludes((v) => !v)} className="text-xs font-medium text-neutral-500 hover:text-neutral-700">
        {showExcludes ? "Hide exclusions" : "Exclude specific people…"}
      </button>

      {showExcludes && (
        <div className="space-y-2.5 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
          <div>
            <Label>Exclude tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ ...criteria, excludeTagIds: toggle(criteria.excludeTagIds, t.id) })}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium",
                    criteria.excludeTagIds.includes(t.id) ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-600",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Exclude stages</Label>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ...criteria, excludeStageIds: toggle(criteria.excludeStageIds, s.id) })}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium",
                    criteria.excludeStageIds.includes(s.id) ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-600",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Exclude timelines</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIMELINE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange({ ...criteria, excludeTimelines: toggle(criteria.excludeTimelines, value) })}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium",
                    criteria.excludeTimelines.includes(value) ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-600",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
