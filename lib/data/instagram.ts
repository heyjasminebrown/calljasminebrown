import { createClient } from "@/lib/supabase/server";

export type InstagramThread = {
  igSenderId: string;
  igUsername: string | null;
  igName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
};

// Grouped by sender, most recent message per thread - mirrors
// listConversations()'s "latest row per group, grouped in JS" approach
// since this dataset is small and Supabase can't easily express that in
// one query either.
export async function getUnmatchedInstagramThreads(): Promise<InstagramThread[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instagram_messages")
    .select("ig_sender_id, ig_username, ig_name, text, occurred_at")
    .is("contact_id", null)
    .order("occurred_at", { ascending: false })
    .limit(300);

  const bySender = new Map<string, InstagramThread>();
  for (const row of data ?? []) {
    const existing = bySender.get(row.ig_sender_id);
    if (existing) {
      existing.messageCount++;
      continue;
    }
    bySender.set(row.ig_sender_id, {
      igSenderId: row.ig_sender_id,
      igUsername: row.ig_username,
      igName: row.ig_name,
      lastMessage: row.text,
      lastMessageAt: row.occurred_at,
      messageCount: 1,
    });
  }

  return [...bySender.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function getInstagramSenderId(contactId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("instagram_contact_links").select("ig_sender_id").eq("contact_id", contactId).maybeSingle();
  return data?.ig_sender_id ?? null;
}
