"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backfillNeedsReply, backfillInsightSignal } from "@/lib/ai/backfill-classification";

// One-time cleanup for the backlog that predates has_signal/needs_reply -
// see lib/ai/backfill-classification.ts's own comment for why this is a
// separate classifier rather than replaying analyzeContactActivity.
export async function runBacklogCleanup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false as const, error: "ANTHROPIC_API_KEY not configured" };

  const admin = createAdminClient();
  const [repliesCleared, insightsCleared] = await Promise.all([
    backfillNeedsReply(admin, user.id),
    backfillInsightSignal(admin, user.id),
  ]);

  return { ok: true as const, repliesCleared, insightsCleared };
}
