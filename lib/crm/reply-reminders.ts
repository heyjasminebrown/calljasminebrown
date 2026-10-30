import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyNewLead } from "@/lib/push/send-push";

// How long an unanswered text sits before it's worth a nudge - long
// enough that a normal reply during the day beats it to the punch, short
// enough that it's still today's conversation, not yesterday's.
const REMINDER_DELAY_HOURS = 2;

// Unlike getRepliesOwedGroup (lib/data/today.ts), which fails OPEN on an
// unevaluated message (null needs_reply still shows on the list, since
// hiding something she might actually owe a reply to is the worse
// mistake), a push notification fails CLOSED: only a message the AI
// positively confirmed needs a reply (needs_reply === true) is worth
// interrupting her for. A maybe isn't worth a buzz on her phone.
export async function sendReplyReminders(admin: SupabaseClient, ownerId: string): Promise<number> {
  const { data } = await admin
    .from("activities")
    .select(
      "id, contact_id, direction, occurred_at, body, needs_reply, reply_reminder_sent_at, reply_dismissed_at, contacts!inner(id, first_name, last_name, archived)",
    )
    .eq("owner_id", ownerId)
    .eq("type", "text")
    .eq("contacts.archived", false)
    .order("occurred_at", { ascending: false })
    .limit(1000);

  const cutoff = Date.now() - REMINDER_DELAY_HOURS * 60 * 60 * 1000;
  const seen = new Set<string>();
  let sent = 0;

  for (const row of data ?? []) {
    const contact = row.contacts as unknown as { id: string; first_name: string; last_name: string } | null;
    if (!contact || seen.has(contact.id)) continue;
    // Only the thread's single most recent text decides anything - an
    // outbound reply since then (even to an older needs_reply text)
    // already cleared it, same "last text in the thread" definition
    // getRepliesOwedGroup uses.
    seen.add(contact.id);

    if (row.direction !== "inbound") continue;
    if (row.needs_reply !== true) continue;
    if (row.reply_reminder_sent_at) continue;
    if (row.reply_dismissed_at) continue;
    if (new Date(row.occurred_at).getTime() > cutoff) continue;

    const name = `${contact.first_name} ${contact.last_name}`.trim();
    const preview = row.body ? `"${row.body.slice(0, 70)}${row.body.length > 70 ? "…" : ""}"` : "Texted you";

    await notifyNewLead(admin, ownerId, {
      title: name,
      body: `Still waiting on a reply — ${preview}`,
      url: `/contacts/${contact.id}`,
    });
    await admin.from("activities").update({ reply_reminder_sent_at: new Date().toISOString() }).eq("id", row.id);
    sent++;
  }

  return sent;
}
