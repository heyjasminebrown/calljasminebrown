import type { ContactWithRelations, PipelineStage } from "@/types/database";

export type Likelihood = "high" | "medium" | "low";

const LEVELS: Likelihood[] = ["low", "medium", "high"];

// Read straight off the stage: Hot = high, Warm = medium, Cold and Nurture
// = low. The "Engaged" tag (they've recently called or texted back) bumps
// it up one level, capped at high. No stage = no likelihood shown.
const STAGE_LEVEL: Record<string, number> = { Cold: 0, Nurture: 0, Warm: 1, Hot: 2 };

export function computeLikelihood(contact: ContactWithRelations, _stages?: PipelineStage[]): Likelihood | null {
  const stage = contact.pipeline_stages;
  if (!stage) return null;

  const base = STAGE_LEVEL[stage.name] ?? 0;
  const engaged = contact.contact_tags.some((ct) => ct.tags?.name === "Engaged");
  return LEVELS[Math.min(base + (engaged ? 1 : 0), LEVELS.length - 1)];
}
