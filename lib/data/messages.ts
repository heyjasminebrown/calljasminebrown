import { createClient } from "@/lib/supabase/server";
import { conversationOwedFromHistory } from "@/lib/crm/message-owed";
import { inboundSmsTimes, lastSms, smsNeedsReply } from "@/lib/crm/messages-v1";
import { isSpamLikeMissedCall } from "@/lib/crm/today-eligible";
import { listAllowlistedPhoneKeys } from "@/lib/crm/spam-signals";
import type { Activity, ContactWithRelations } from "@/types/database";

export { inboxOwedCount } from "@/lib/crm/message-owed";

type ContactSummary = Pick<
  ContactWithRelations,
  "id" | "first_name" | "last_name" | "phone" | "contact_type" | "timeline" | "representing" | "pipeline_stages" | "contact_tags" | "archived" | "spam"
>;

export type Conversation = {
  contact: ContactSummary;
  lastActivity: Activity;
  owed: boolean;
  owedActivity: Activity | null;
  lastSms: Activity | null;
  lastInboundSmsAt: string | null;
  smsNeedsReply: boolean;
  recentInboundSmsAt: string[];
};

// Supabase's JS client can't easily express "latest row per group" in one
// query, and this dataset (one agent's calls/texts) is small enough that
// fetching a reasonably large recent window and grouping in JS is simpler
// and fast enough than a custom SQL view/RPC.
//
// Hidden (archived) contacts - spam/trash leads - are excluded by default,
// reusing the same `archived` flag the rest of the app already treats as
// "soft trash." Pass hidden: true to see the hidden list instead.
//
// Spam-flagged contacts (contacts.spam - see migration 0066) are a second,
// orthogonal exclusion: kept, not archived, so they stay recoverable and
// visible in their own bucket, but they must never appear in the normal
// inbox, its badge count, or Today's replies-owed group. Pass spam: true to
// see the bucket instead. Hidden already covers "archived for any reason"
// (including a spam call that was explicitly deleted from the bucket), so
// the spam filter only applies when hidden is NOT requested.
//
// filter narrows which conversations come back: "owed" only the ones
// isConversationOwed flags, "calls" only call-type threads (missed or
// answered), "all"/undefined everything - all three still compute `owed`
// per row so the caller can style rows consistently either way.
export async function listConversations(opts?: { hidden?: boolean; spam?: boolean; filter?: "owed" | "all" | "calls" }): Promise<Conversation[]> {
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(
      "*, contacts!inner(id, first_name, last_name, phone, contact_type, timeline, representing, archived, spam, pipeline_stages(*), contact_tags(tags(*)))",
    )
    .eq("contacts.archived", !!opts?.hidden)
    .in("type", ["call", "text"])
    .order("occurred_at", { ascending: false })
    .limit(1000);

  if (!opts?.hidden) query = query.eq("contacts.spam", !!opts?.spam);

  const { data } = await query;

  const byContact = new Map<string, { contact: ContactSummary; activities: Activity[] }>();
  function ingest(rows: typeof data) {
    for (const row of rows ?? []) {
      const contact = row.contacts as unknown as ContactSummary | null;
      if (!contact) continue;
      const { contacts: _contacts, ...activity } = row as Activity & { contacts: unknown };
      const entry = byContact.get(contact.id);
      if (entry) {
        entry.activities.push(activity as Activity);
      } else {
        byContact.set(contact.id, { contact, activities: [activity as Activity] });
      }
    }
  }
  ingest(data);

  const allowlisted = await listAllowlistedPhoneKeys(supabase);

  // Realtor robocalls usually auto-create a contact named after the phone
  // and never get contacts.spam=true (no transcript yet / rotating CID).
  // Those belong in the spam bucket with flagged spam, not the inbox.
  if (opts?.spam) {
    const { data: stubs } = await supabase
      .from("activities")
      .select(
        "*, contacts!inner(id, first_name, last_name, phone, contact_type, timeline, representing, archived, spam, pipeline_stages(*), contact_tags(tags(*)))",
      )
      .eq("contacts.archived", false)
      .eq("contacts.spam", false)
      .in("type", ["call", "text"])
      .order("occurred_at", { ascending: false })
      .limit(1000);
    ingest(stubs);
  }

  // Discovery window only decides who is in the inbox. Owed/unread walks
  // each of those contacts' full call/text history so a later answered
  // call cannot hide an older inbound text the 1000-row window missed —
  // that was Today (1000 rows, full-group walk) showing 1 while Messages
  // (truncated 300) showed 0.
  const contactIds = [...byContact.keys()];
  const historyByContact = new Map<string, Activity[]>();
  for (let i = 0; i < contactIds.length; i += 200) {
    const chunk = contactIds.slice(i, i + 200);
    const { data: history } = await supabase
      .from("activities")
      .select("*")
      .in("contact_id", chunk)
      .in("type", ["call", "text"])
      .order("occurred_at", { ascending: false });
    for (const row of history ?? []) {
      const list = historyByContact.get(row.contact_id) ?? [];
      list.push(row as Activity);
      historyByContact.set(row.contact_id, list);
    }
  }

  const conversations: Conversation[] = [];
  for (const { contact, activities } of byContact.values()) {
    const lastActivity = activities[0];
    if (opts?.filter === "calls" && lastActivity.type !== "call") continue;
    const thread = historyByContact.get(contact.id) ?? activities;
    const { owed, activity } = conversationOwedFromHistory(thread);
    const spamLike = !!(activity && isSpamLikeMissedCall(contact, activity, allowlisted));
    if (opts?.spam) {
      if (!contact.spam && !spamLike) continue;
    } else if (!opts?.hidden && spamLike) {
      continue;
    }
    const showOwed = opts?.spam || opts?.hidden ? owed : owed && !spamLike;
    if (opts?.filter === "owed" && !showOwed) continue;
    const inboundTimes = inboundSmsTimes(thread);
    conversations.push({
      contact,
      lastActivity,
      owed: showOwed,
      owedActivity: showOwed ? activity : null,
      lastSms: lastSms(thread),
      lastInboundSmsAt: inboundTimes[0] ?? null,
      smsNeedsReply: smsNeedsReply(thread),
      recentInboundSmsAt: inboundTimes.slice(0, 50),
    });
  }

  return conversations;
}

export async function getContactThread(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .in("type", ["call", "text"])
    .order("occurred_at", { ascending: true });
  return (data ?? []) as Activity[];
}

export type TextableContact = { id: string; first_name: string; last_name: string; phone: string | null };

// For the "new message" contact picker - anyone without a phone number
// can't be texted, so there's no point surfacing them there.
export async function listTextableContacts(): Promise<TextableContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone")
    .eq("archived", false)
    .not("phone", "is", null)
    .order("first_name", { ascending: true });
  return (data ?? []) as TextableContact[];
}
