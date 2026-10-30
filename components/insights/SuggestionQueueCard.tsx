import { Sparkles } from "lucide-react";
import { InsightCard } from "@/components/insights/InsightCard";
import { SuggestedRow } from "@/components/contacts/SuggestedRow";
import { ApplyAllStageMoves, type StageMoveItem } from "@/components/insights/ApplyAllStageMoves";
import type { SuggestionQueue } from "@/lib/data/insights";
import type { PipelineStage, Tag } from "@/types/database";

// The one queue suggestions live in now - collapsed by default on desktop
// (an inbound text should add to a count, not interrupt with a card),
// expanded by default on mobile since there's no persistent sidebar count
// to glance at instead.
export function SuggestionQueueCard({
  queue,
  ownerId,
  stages,
  tags,
  mobile = false,
}: {
  queue: SuggestionQueue;
  ownerId: string;
  stages: PipelineStage[];
  tags: Tag[];
  mobile?: boolean;
}) {
  if (queue.count === 0) return null;

  const stageMoveIds = new Set(queue.stageMoveOnlyContactIds);
  const stageMoveItems: StageMoveItem[] = queue.rows
    .filter((r) => stageMoveIds.has(r.contactId))
    .map((r) => ({
      contactId: r.contactId,
      currentStageId: r.contactStageId,
      targetStageId: r.insight.suggested_stage_id as string,
      insightId: r.insight.id,
      extraInsightIds: r.extraInsightIds,
      summary: r.insight.summary,
    }));

  return (
    <InsightCard
      icon={<Sparkles size={18} />}
      title={`${queue.count} ${queue.count === 1 ? "person" : "people"} said something worth acting on`}
      subtitle={queue.names.join(", ")}
      expandedSubtitle={`From calls and texts since ${queue.sinceLabel}`}
      defaultOpen={mobile}
      action={!mobile && stageMoveItems.length > 0 ? <ApplyAllStageMoves ownerId={ownerId} stages={stages} items={stageMoveItems} /> : undefined}
    >
      {queue.rows.map((row) => (
        <SuggestedRow
          key={row.contactId}
          insight={row.insight}
          contactId={row.contactId}
          ownerId={ownerId}
          contactStageId={row.contactStageId}
          contactName={row.contactName}
          contactCreatedAt={row.contactCreatedAt}
          representing={row.representing}
          stages={stages}
          tags={tags}
          showContactName
          meta={row.meta}
          extraInsightIds={row.extraInsightIds}
          stacked={mobile}
        />
      ))}
      <p className="px-[18px] py-2.5 text-sm text-neutral-400">
        One row per person, newest read on top. Nothing here has changed a stage, a timeline, or a tag until you apply it.
      </p>
    </InsightCard>
  );
}
