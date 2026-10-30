"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addToSpamAllowlist } from "@/lib/crm/spam-signals";

type ActionResult = { ok: true } | { ok: false; error: string };

// "Not spam" - moves the call back into the inbox and, via the allowlist,
// stops any rule from ever re-matching this number again. Does not touch
// the engagement pipeline that was skipped when it was first flagged (no
// engagement tag, no AI read of that original call) - only what comes in
// from here counts as a real touch.
export async function markNotSpam(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: contact } = await supabase.from("contacts").select("phone").eq("id", contactId).maybeSingle();
  if (!contact) return { ok: false, error: "Contact not found" };

  const { error } = await supabase.from("contacts").update({ spam: false }).eq("id", contactId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activities").update({ reply_dismissed_at: null }).eq("contact_id", contactId).eq("type", "call");
  await addToSpamAllowlist(supabase, user.id, contact.phone);

  revalidatePath("/messages");
  revalidatePath("/");
  return { ok: true };
}

// "Delete" in the bucket - the owner's own framing: recoverable archive,
// never a hard delete. Reuses the exact flag Hidden already surfaces.
export async function archiveSpam(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ archived: true }).eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  revalidatePath("/");
  return { ok: true };
}

export async function archiveAllSpam(): Promise<{ ok: true; contactIds: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: contacts } = await supabase.from("contacts").select("id").eq("spam", true).eq("archived", false);
  const ids = (contacts ?? []).map((c) => c.id);
  if (ids.length === 0) return { ok: true, contactIds: [] };

  const { error } = await supabase.from("contacts").update({ archived: true }).in("id", ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/messages");
  revalidatePath("/");
  return { ok: true, contactIds: ids };
}

// Undo for archiveAllSpam's toast - reverses archived on exactly the ids
// that call just affected, not "every archived contact."
export async function unarchiveContacts(contactIds: string[]): Promise<ActionResult> {
  if (contactIds.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ archived: false }).in("id", contactIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  revalidatePath("/");
  return { ok: true };
}
