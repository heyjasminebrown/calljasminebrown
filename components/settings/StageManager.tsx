import type { PipelineStage } from "@/types/database";

// Stages are fixed to Cold, Warm, Hot, Nurture (supabase/migrations/0083):
// imports, defaults and the Today "hot" queue match them by name, so
// renaming, adding or deleting here would quietly break those. Shown
// read-only with each stage's head count.
export function StageManager({ stages, stageCounts }: { stages: PipelineStage[]; ownerId?: string; stageCounts?: Record<string, number> }) {
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <p className="text-[16px] font-semibold text-neutral-900">Pipeline stages</p>
      <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-500">
        Every contact can be in one of these four stages, or no stage. Stage is separate from Type, and changing
        it never removes a contact&apos;s history.
      </p>
      <div className="mt-3 space-y-2.5">
        {sorted.map((stage) => (
          <div key={stage.id} className="flex items-center gap-2.5 border-b border-neutral-100 pb-2.5 last:border-b-0 last:pb-0">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="flex-1 text-[15px] font-medium text-neutral-900">{stage.name}</span>
            {stageCounts && (
              <span className="shrink-0 text-[15px] text-neutral-500">
                {stageCounts[stage.id] ?? 0} {(stageCounts[stage.id] ?? 0) === 1 ? "person" : "people"}
              </span>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-[15px] text-red-600">
            No stages found. Run supabase/migrations/0083_relationship_type_and_stages.sql in the Supabase SQL Editor.
          </p>
        )}
      </div>
    </div>
  );
}
