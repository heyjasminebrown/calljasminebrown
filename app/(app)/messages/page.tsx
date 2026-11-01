import { cookies } from "next/headers";
import Link from "next/link";
import { inboxOwedCount, listConversations, listTextableContacts } from "@/lib/data/messages";
import { listMergeCandidates } from "@/lib/data/contacts";
import { getUnmatchedInstagramThreads } from "@/lib/data/instagram";
import { ConversationRow } from "@/components/messages/ConversationRow";
import { NotOwedList } from "@/components/messages/NotOwedList";
import { NewMessageButton } from "@/components/messages/NewMessageButton";
import { InstagramStrangerRow } from "@/components/messages/InstagramStrangerRow";
import { MessageFilters } from "@/components/messages/MessageFilters";
import { SpamBucket } from "@/components/messages/SpamBucket";
import { MessagesInbox } from "@/components/messages/MessagesInbox";
import { Section } from "@/components/ui/Section";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { INBOX_SEEN_COOKIE, parseInboxSeen } from "@/lib/crm/inbox-seen";
import { inboxHref } from "@/lib/crm/inbox-href";
import { parseMessagesFilter, toSmsInboxThreads } from "@/lib/crm/messages-v1";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ hidden?: string; filter?: string; spam?: string }>;
}) {
  const { hidden: hiddenParam, filter: filterParam, spam: spamParam } = await searchParams;
  const hidden = hiddenParam === "1";
  const spam = !hidden && spamParam === "1";

  if (!hidden && !spam) {
    const [conversations, cookieStore] = await Promise.all([listConversations(), cookies()]);
    return (
      <div className="lg:flex lg:min-h-0 lg:flex-1 lg:!shrink lg:flex-col lg:overflow-hidden lg:px-8 lg:pt-8 lg:pb-6">
        <MessagesInbox
          threads={toSmsInboxThreads(conversations)}
          initialSeen={parseInboxSeen(cookieStore.get(INBOX_SEEN_COOKIE)?.value)}
          filter={parseMessagesFilter(filterParam)}
        />
      </div>
    );
  }

  const legacyFilter: "owed" | "all" | "calls" = filterParam === "owed" || filterParam === "calls" ? filterParam : "all";
  const [conversations, spamConversations, contacts, instagramThreads, mergeCandidates] = await Promise.all([
    listConversations({ hidden }),
    hidden ? Promise.resolve([]) : listConversations({ spam: true }),
    listTextableContacts(),
    hidden ? Promise.resolve([]) : getUnmatchedInstagramThreads(),
    hidden ? Promise.resolve([]) : listMergeCandidates(),
  ]);

  const owedCount = inboxOwedCount(conversations);
  const visible =
    legacyFilter === "owed"
      ? conversations.filter((c) => c.owed)
      : legacyFilter === "calls"
        ? conversations.filter((c) => c.lastActivity.type === "call")
        : conversations;
  const owedVisible = visible.filter((c) => c.owed);
  const notOwedVisible = visible.filter((c) => !c.owed);

  if (spam) {
    return (
      <div className="mx-auto max-w-2xl overflow-x-hidden">
        <SpamBucket conversations={spamConversations} />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1400px] overflow-x-hidden px-4 lg:px-8">
        <div className="flex items-start justify-between gap-3 pt-5 pb-4 lg:pt-8">
          <div>
            <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em] text-neutral-900">Hidden threads</h1>
            <p className="mt-0.5 text-[15px] leading-[22px] text-neutral-600">Spam/trash leads you&apos;ve hidden from the inbox.</p>
          </div>
          <NewMessageButton contacts={contacts} />
        </div>
        <div className="px-4 pb-4">
          <Link href={inboxHref()} className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to inbox
          </Link>
        </div>
        <MessageFilters activeFilter={legacyFilter} owedCount={owedCount} spamCount={spamConversations.length} />
        {instagramThreads.length > 0 && (
          <div className="px-4 pt-3">
            <Section sectionKey="messages:instagram" title="Instagram · new" meta={`${instagramThreads.length}`}>
              {instagramThreads.map((thread) => (
                <InstagramStrangerRow key={thread.igSenderId} thread={thread} contacts={mergeCandidates} />
              ))}
            </Section>
          </div>
        )}
        <div className="space-y-2 px-4 py-3">
          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">Nothing hidden.</p>
          ) : (
            <>
              {owedVisible.map((c) => (
                <ConversationRow key={c.contact.id} conversation={c} filter={legacyFilter} hidden={hidden} />
              ))}
              {notOwedVisible.length > 0 && <p className="px-0.5 pb-1 pt-2 text-base font-semibold text-neutral-900">Nothing owed</p>}
              <NotOwedList conversations={notOwedVisible} filter={legacyFilter} hidden={hidden} />
            </>
          )}
        </div>
        {legacyFilter === "all" && spamConversations.length > 0 && (
          <div className="px-4 pb-4">
            <Link
              href={inboxHref({ spam: true })}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-[#fcfbfa] px-4 py-3.5"
            >
              <ShieldAlert size={18} className="shrink-0 text-neutral-400" />
              <p className="min-w-0 flex-1 text-sm text-neutral-600">
                <span className="font-bold text-neutral-900">{spamConversations.length}</span> calls filed as spam today — kept out of the list
                above and out of the badge
              </p>
              <span className="shrink-0 text-sm font-semibold text-neutral-800">Review</span>
              <ChevronRight size={17} className="shrink-0 text-neutral-400" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
