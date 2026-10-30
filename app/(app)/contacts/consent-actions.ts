"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markOptedOut(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  await admin.from("contacts").update({ opted_out_at: new Date().toISOString() }).eq("id", contactId);
  return { ok: true as const };
}

// Deliberately manual only - the one place this app is strict rather than
// suggestive. Nothing automatic ever clears an opt-out.
export async function clearOptOut(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  await admin.from("contacts").update({ opted_out_at: null }).eq("id", contactId);
  return { ok: true as const };
}
