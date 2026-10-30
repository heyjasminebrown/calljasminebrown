"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backfillSuggestedTags } from "@/lib/ai/backfill-classification";

// One-time sweep of the historical backlog against the tag-suggestion
// classifier - see lib/ai/backfill-classification.ts's own comment for
// why this runs in bounded batches rather than all at once.
export async function runTagSuggestionBackfill() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false as const, error: "ANTHROPIC_API_KEY not configured" };

  const admin = createAdminClient();
  const { processed, suggested, remaining } = await backfillSuggestedTags(admin, user.id);

  return { ok: true as const, processed, suggested, remaining };
}
