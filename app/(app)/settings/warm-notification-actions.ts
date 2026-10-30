"use server";

import { createClient } from "@/lib/supabase/server";
import type { WarmNotificationSettings } from "@/types/database";

export async function updateWarmNotificationRule(rule: keyof Omit<WarmNotificationSettings, "owner_id" | "updated_at">, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  await supabase
    .from("warm_notification_settings")
    .upsert({ owner_id: user.id, [rule]: enabled, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });

  return { ok: true as const };
}
