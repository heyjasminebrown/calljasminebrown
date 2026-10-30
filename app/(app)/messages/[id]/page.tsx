import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MessagesInbox } from "@/components/messages/MessagesInbox";
import { getContact } from "@/lib/data/contacts";
import { getContactThread, listConversations } from "@/lib/data/messages";
import { createClient } from "@/lib/supabase/server";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { firstTouchTemplate, resolveFirstTouchSource, shouldPrefillFirstTouchSms, eventbriteAccountFromActivities } from "@/lib/crm/new-lead-text-templates";
import { INBOX_SEEN_COOKIE, parseInboxSeen } from "@/lib/crm/inbox-seen";
import { parseMessagesFilter, toSmsInboxThreads, type OpenSmsThread, type SmsThreadMessage } from "@/lib/crm/messages-v1";

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ draft?: string; from?: string }>;
}) {
  const { id } = await params;
  const { draft, from } = await searchParams;
  const supabase = await createClient();
  const [contact, thread, conversations, cookieStore, { data: eventbriteRows }] = await Promise.all([
    getContact(id),
    getContactThread(id),
    listConversations(),
    cookies(),
    supabase.from("activities").select("metadata").eq("contact_id", id).eq("source", "eventbrite").limit(5),
  ]);

  if (!contact) notFound();

  const sms = thread.filter((activity) => activity.type === "text");
  const tagNames = contact.contact_tags.map((ct) => ct.tags?.name).filter((name): name is string => !!name);
  const firstTouchSignals = {
    leadSource: contact.lead_source,
    lastEventName: contact.last_event_name,
    tagNames,
    eventbriteAccount: eventbriteAccountFromActivities(eventbriteRows ?? []),
  };
  const source = resolveFirstTouchSource(firstTouchSignals);
  const hasOutboundText = sms.some((a) => a.direction === "outbound");
  const firstTouchBody = shouldPrefillFirstTouchSms({ hasOutboundText, source })
    ? applyMergeFields(firstTouchTemplate(firstTouchSignals), contact)
    : undefined;

  const messages: SmsThreadMessage[] = sms.map((activity) => ({
    id: activity.id,
    direction: activity.direction === "outbound" ? "outbound" : "inbound",
    body: activity.body,
    occurredAt: activity.occurred_at,
  }));

  const openThread: OpenSmsThread = {
    contactId: contact.id,
    firstName: contact.first_name,
    lastName: contact.last_name ?? "",
    phone: contact.phone,
    stageName: contact.pipeline_stages?.name ?? null,
    representing: contact.representing ?? null,
    messages,
    draft: draft || firstTouchBody,
  };

  return (
    <div className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden lg:px-8 lg:pt-8 lg:pb-6">
      <MessagesInbox
        threads={toSmsInboxThreads(conversations)}
        initialSeen={parseInboxSeen(cookieStore.get(INBOX_SEEN_COOKIE)?.value)}
        filter={parseMessagesFilter(from)}
        selected={contact.id}
        openThread={openThread}
      />
    </div>
  );
}
