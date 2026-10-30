import { createClient } from "@/lib/supabase/server";
import { withProgress, type TextBlastWithProgress } from "@/lib/crm/text-blasts";

// Dashboard's "in progress" card - only ever a handful of rows at once (a
// blast finishes and drops out of "sending" status within an hour or two),
// so no pagination needed.
export async function listInProgressTextBlasts(): Promise<TextBlastWithProgress[]> {
  const supabase = await createClient();
  const { data: blasts } = await supabase.from("text_blasts").select("*").eq("status", "sending").order("created_at", { ascending: false });
  if (!blasts?.length) return [];

  const { data: recipients } = await supabase
    .from("text_blast_recipients")
    .select("blast_id, status")
    .in(
      "blast_id",
      blasts.map((b) => b.id),
    );

  return withProgress(blasts, recipients ?? []);
}
