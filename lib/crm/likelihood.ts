import type { ContactWithRelations, PipelineStage } from "@/types/database";

export type Likelihood = "high" | "medium" | "low";

// Deterministic first pass, not an LLM call - transparent and instant,
// which matters more here than nuance for a coarse "where should I focus"
// signal on the pipeline board. Inputs are all already loaded with the
// contact (stage, timeline, Engaged tag), so this costs nothing extra.
const TIMELINE_SCORE: Record<string, number> = {
  asap: 3,
  "1_3_months": 2,
  "3_6_months": 1,
  "6_12_months": 0,
  "12_plus_months": -1,
  just_browsing: -2,
  unknown: 0,
};

export function computeLikelihood(contact: ContactWithRelations, stages: PipelineStage[]): Likelihood | null {
  const stage = contact.pipeline_stages;
  if (!stage || stage.is_closed_won || stage.is_closed_lost || stage.is_trash) return null;

  const activeStages = stages
    .filter((s) => !s.is_closed_won && !s.is_closed_lost && !s.is_trash)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = activeStages.findIndex((s) => s.id === stage.id);
  const stageScore = activeStages.length > 1 ? (idx / (activeStages.length - 1)) * 3 : 1.5;

  const timelineScore = TIMELINE_SCORE[contact.timeline] ?? 0;
  const engaged = contact.contact_tags.some((ct) => ct.tags?.name === "Engaged");

  const total = stageScore + timelineScore + (engaged ? 2 : 0);
  if (total >= 5) return "high";
  if (total >= 2) return "medium";
  return "low";
}
