import type { PipelineStage } from "@/types/database";

export function StageJumpChips({ stages }: { stages: (PipelineStage & { count: number })[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2 px-4 md:hidden">
      {stages.map((stage) => (
        <a
          key={stage.id}
          href={`#pipeline-stage-${stage.id}`}
          className="h-11 whitespace-nowrap rounded-full border border-neutral-200 px-3.5 text-[14px] font-medium leading-[44px] text-neutral-600"
        >
          {stage.name} {stage.count}
        </a>
      ))}
    </div>
  );
}
