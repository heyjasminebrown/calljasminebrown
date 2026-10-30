import { Section } from "@/components/ui/Section";
import { StageManager } from "@/components/settings/StageManager";
import { TagManager } from "@/components/settings/TagManager";
import type { PipelineStage, Tag } from "@/types/database";

// Merged because they're the same kind of rarely-touched configuration -
// collapsed by default so a page that's almost entirely once-a-year
// settings isn't as long as the dashboard.
export function PipelineStagesAndTags({
  stages,
  tags,
  ownerId,
  stageCounts,
}: {
  stages: PipelineStage[];
  tags: Tag[];
  ownerId: string;
  stageCounts: Record<string, number>;
}) {
  return (
    <Section sectionKey="settings:stages-tags" title="Pipeline stages and tags" meta={`${stages.length} stages · ${tags.length} tags`} defaultOpen={false}>
      <div className="space-y-5 px-[18px] py-4">
        <StageManager stages={stages} ownerId={ownerId} stageCounts={stageCounts} />
        <div className="border-t border-neutral-100 pt-5">
          <TagManager tags={tags} ownerId={ownerId} />
        </div>
      </div>
    </Section>
  );
}
