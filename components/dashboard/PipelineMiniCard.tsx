import Link from "next/link";
import type { PipelineStage } from "@/types/database";

// Restyled StageBreakdown for the Today two-up footer: every stage is grey
// now except Hot, which gets the one accent color - color means "this is
// the stage that matters right now," not "here's a rainbow of stages."
export function PipelineMiniCard({ stages, counts }: { stages: PipelineStage[]; counts: Map<string, number> }) {
  const active = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost && !s.is_trash);
  const max = Math.max(1, ...active.map((s) => counts.get(s.id) ?? 0));

  return (
    <div className="rounded-2xl border border-[#ebe9e7] bg-white p-[18px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">Pipeline</h3>
        <Link href="/pipeline" className="text-sm font-medium text-neutral-500">
          View all
        </Link>
      </div>
      <div className="space-y-2.5">
        {active.map((stage) => {
          const count = counts.get(stage.id) ?? 0;
          const isHot = stage.name.toLowerCase().includes("hot");
          const pct = Math.round((count / max) * 100);
          return (
            <Link key={stage.id} href={`/pipeline?stage=${stage.id}`} className="block">
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">{stage.name}</span>
                <span className={`shrink-0 ${isHot ? "font-semibold text-brand-600" : "text-neutral-400"}`}>{count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${isHot ? "bg-brand-600" : "bg-neutral-300"}`}
                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
