"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeDismissal } from "@/lib/crm/dismissed-insights";

async function dismiss(key: string, contactId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const result = await writeDismissal(supabase, user.id, key, contactId);
  if (!result.ok) return result;
  revalidatePath("/insights");
  return { ok: true as const };
}

// Per-contact: dismissing one lease row (or resurfacing later if
// lease_ends_at changes, since the key is built from the date).
export async function dismissLease(dismissKey: string, contactId: string) {
  return dismiss(dismissKey, contactId);
}

// Whole-card: dismissing "Hot/Ready gone quiet", "Regulars never called",
// "Past clients past two years", or "Data problems" hides the entire card
// for 30 days.
export async function dismissCard(cardKey: string) {
  return dismiss(cardKey, null);
}
