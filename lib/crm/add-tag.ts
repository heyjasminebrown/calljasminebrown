import type { SupabaseClient } from "@supabase/supabase-js";

// Adds a tag (creating it if needed) to a contact. Safe to import from
// code that also runs in the browser.
export async function addTagByName(admin: SupabaseClient, ownerId: string, contactId: string, tagName: string): Promise<boolean> {
  let { data: tag } = await admin.from("tags").select("id").eq("owner_id", ownerId).eq("name", tagName).maybeSingle();

  if (!tag) {
    const { data: created } = await admin
      .from("tags")
      .insert({ owner_id: ownerId, name: tagName })
      .select("id")
      .maybeSingle();
    tag = created;
  }
  if (!tag) return false;

  const { error } = await admin.from("contact_tags").upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id" });
  return !error;
}
