"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordDailyRate } from "@/lib/crm/rate-feed";

export async function recordManualRate(ratePct: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!ratePct || ratePct <= 0 || ratePct > 20) return { ok: false as const, error: "Enter a real rate, like 6.5" };

  await recordDailyRate(createAdminClient(), user.id, ratePct, "manual");
  revalidatePath("/insights");
  revalidatePath("/settings");
  return { ok: true as const };
}
