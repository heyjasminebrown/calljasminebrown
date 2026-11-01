import type { SupabaseClient } from "@supabase/supabase-js";

// Makes a contact's tags exactly `tagIds`, touching only what changed.
// (Deleting every tag and re-adding them would look like "tag added" to
// tag-triggered text campaigns and could text someone just because their
// contact was edited.) Returns the exact error, or null.
export async function syncContactTags(supabase: SupabaseClient, contactId: string, tagIds: string[]): Promise<string | null> {
  const { data, error } = await supabase.from("contact_tags").select("tag_id").eq("contact_id", contactId);
  if (error) return error.message;
  const current = new Set((data ?? []).map((r) => r.tag_id as string));
  const wanted = new Set(tagIds);
  const removed = [...current].filter((id) => !wanted.has(id));
  const added = [...wanted].filter((id) => !current.has(id));

  if (removed.length) {
    const { error: e } = await supabase.from("contact_tags").delete().eq("contact_id", contactId).in("tag_id", removed);
    if (e) return e.message;
  }
  if (added.length) {
    const { error: e } = await supabase.from("contact_tags").insert(added.map((tag_id) => ({ contact_id: contactId, tag_id })));
    if (e) return e.message;
  }
  return null;
}
