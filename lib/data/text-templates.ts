import { createClient } from "@/lib/supabase/server";
import type { TextTemplate } from "@/types/database";

export async function listTextTemplates(): Promise<TextTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("text_templates").select("*").order("sort_order", { ascending: true });
  return (data as TextTemplate[]) ?? [];
}

// Falls back to the first template in sort order when nothing is flagged
// as the default draft, so Today's Up-next card always has something to
// show once she's saved at least one template, rather than requiring a
// second setup step.
export async function getDefaultDraftTemplate(): Promise<TextTemplate | null> {
  const templates = await listTextTemplates();
  if (templates.length === 0) return null;
  return templates.find((t) => t.is_default_draft) ?? templates[0];
}
