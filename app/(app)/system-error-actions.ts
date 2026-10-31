"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// Dismisses one error, or every open one when `id` is omitted.
export async function dismissSystemErrors(id?: string): Promise<ActionResult> {
  const supabase = await createClient();
  let query = supabase.from("system_errors").update({ resolved_at: new Date().toISOString() }).is("resolved_at", null);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
