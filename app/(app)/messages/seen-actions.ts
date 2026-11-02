"use server";

import { cookies } from "next/headers";
import { INBOX_SEEN_COOKIE, markInboxSeen, parseInboxSeen } from "@/lib/crm/inbox-seen";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "No reply needed": clears Needs reply for the whole thread (every
// inbound text not already dismissed) and marks it read. Messages stay;
// their next text puts it back in Needs reply.
export async function markNoReplyNeeded(contactId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ reply_dismissed_at: new Date().toISOString() })
    .eq("contact_id", contactId)
    .eq("type", "text")
    .eq("direction", "inbound")
    .is("reply_dismissed_at", null);
  if (error) return { ok: false, error: error.message };
  await markInboxThreadSeen(contactId);
  revalidatePath("/messages", "layout");
  return { ok: true };
}

export async function markInboxThreadSeen(contactId: string) {
  if (!contactId) return;
  const store = await cookies();
  const next = markInboxSeen(parseInboxSeen(store.get(INBOX_SEEN_COOKIE)?.value), contactId);
  store.set(INBOX_SEEN_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}
