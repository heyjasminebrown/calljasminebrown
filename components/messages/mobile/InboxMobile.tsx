"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ShieldAlert, ChevronDown } from "lucide-react";
import { NewMessageButton } from "@/components/messages/NewMessageButton";
import { InstagramStrangerRow } from "@/components/messages/InstagramStrangerRow";
import { InboxRow } from "@/components/messages/mobile/InboxRow";
import { SpamInboxRow } from "@/components/messages/mobile/SpamInboxRow";
import { StickyGroupHeader } from "@/components/mobile/StickyGroupHeader";
import { Toast } from "@/components/mobile/Toast";
import { useToast } from "@/lib/hooks/useToast";
import { useSectionOpen } from "@/lib/hooks/useSectionOpen";
import { archiveAllSpam, unarchiveContacts } from "@/app/(app)/messages/spam-actions";
import { inboxHref } from "@/lib/crm/inbox-href";
import { cn } from "@/lib/utils";
import type { Conversation, TextableContact } from "@/lib/data/messages";
import type { InstagramThread } from "@/lib/data/instagram";
import type { MergeCandidate } from "@/lib/data/contacts";

type Filter = "owed" | "all" | "calls";

export function InboxMobile({
  conversations,
  spamConversations,
  contacts,
  instagramThreads,
  mergeCandidates,
  ownerId,
  filter: filterProp = "all",
}: {
  conversations: Conversation[];
  spamConversations: Conversation[];
  contacts: TextableContact[];
  instagramThreads: InstagramThread[];
  mergeCandidates: MergeCandidate[];
  ownerId: string;
  filter?: Filter;
}) {
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const filter = filterProp;
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [spamOpen, setSpamOpen] = useSectionOpen("messages:spam-mobile", true);
  const [clearing, setClearing] = useState(false);

  async function handleClearAllSpam() {
    setClearing(true);
    const result = await archiveAllSpam();
    setClearing(false);
    if (!result.ok) {
      showToast("Couldn't clear those", "error");
      return;
    }
    const { contactIds } = result;
    router.refresh();
    if (contactIds.length > 0) {
      showToast(`${contactIds.length} spam calls archived`, "default", {
        label: "Undo",
        onClick: async () => {
          await unarchiveContacts(contactIds);
          router.refresh();
        },
      });
    }
  }

  const owedCount = conversations.filter((c) => c.owed).length;
  const visible =
    filter === "owed" ? conversations.filter((c) => c.owed) : filter === "calls" ? conversations.filter((c) => c.lastActivity.type === "call") : conversations;
  const owedVisible = visible.filter((c) => c.owed);
  const notOwedVisible = visible.filter((c) => !c.owed);

  return (
    <div className="pb-4 lg:hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-5 pb-3">
        <div>
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-neutral-900">Messages</p>
          <p className="mt-0.5 text-[15px] text-neutral-500">
            {owedCount > 0 ? `${owedCount} ${owedCount === 1 ? "person is" : "people are"} waiting on you.` : "Nothing waiting on you."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={inboxHref({ hidden: true })} aria-label="Hidden threads" className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
            <Archive size={18} />
          </Link>
          <NewMessageButton contacts={contacts} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {[
          { value: "owed" as Filter, label: `Needs a reply ${owedCount}` },
          { value: "all" as Filter, label: `All ${conversations.length}` },
          { value: "calls" as Filter, label: "Calls" },
        ].map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => router.push(inboxHref({ filter: chip.value }))}
            className={`h-11 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium ${filter === chip.value ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600"}`}
          >
            {chip.label}
          </button>
        ))}
        {instagramThreads.length > 0 && (
          <span className="flex h-11 items-center whitespace-nowrap rounded-full border border-neutral-200 px-3.5 text-[14px] font-medium text-neutral-600">
            Instagram {instagramThreads.length}
          </span>
        )}
        {spamConversations.length > 0 && (
          <button
            type="button"
            onClick={() => setSpamOpen(true)}
            className="flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-200 px-3.5 text-[14px] font-medium text-neutral-600"
          >
            <ShieldAlert size={14} className="text-neutral-400" /> Spam {spamConversations.length}
          </button>
        )}
      </div>

      {instagramThreads.length > 0 && (
        <div className="mb-3 px-4">
          <StickyGroupHeader label="Instagram · new" count={instagramThreads.length} collapsible sectionKey="messages:instagram-mobile" defaultOpen>
            <div className="divide-y divide-neutral-100 rounded-b-[14px] border border-t-0 border-[#ebe9e7] bg-white">
              {instagramThreads.map((thread) => (
                <InstagramStrangerRow key={thread.igSenderId} thread={thread} contacts={mergeCandidates} />
              ))}
            </div>
          </StickyGroupHeader>
        </div>
      )}

      <div className="rounded-[16px] border border-[#ebe9e7] bg-white">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-neutral-400">{filter === "owed" ? "Nothing owed." : "Nothing here yet."}</p>
        ) : (
          <>
            {owedVisible.length > 0 && (
              <StickyGroupHeader label="Waiting on you" count={owedVisible.length}>
                <div className="divide-y divide-neutral-100">
                  {owedVisible.map((c) => (
                    <InboxRow key={c.contact.id} conversation={c} ownerId={ownerId} openRowId={openRowId} onOpenChange={setOpenRowId} filter={filter} />
                  ))}
                </div>
              </StickyGroupHeader>
            )}
            {notOwedVisible.length > 0 && (
              <StickyGroupHeader label="Nothing owed" count={notOwedVisible.length}>
                <div className="divide-y divide-neutral-100">
                  {notOwedVisible.map((c) => (
                    <InboxRow key={c.contact.id} conversation={c} ownerId={ownerId} openRowId={openRowId} onOpenChange={setOpenRowId} filter={filter} />
                  ))}
                </div>
              </StickyGroupHeader>
            )}
          </>
        )}
      </div>

      {spamConversations.length > 0 && (
        <div className="mt-3 rounded-[16px] border border-[#ebe9e7] bg-white">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-[#ebe9e7] bg-neutral-100 px-4 py-[7px]">
            <button type="button" onClick={() => setSpamOpen(!spamOpen)} className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold uppercase tracking-[0.05em] text-neutral-700">
                Spam <span className="font-normal normal-case tracking-normal text-neutral-400">{spamConversations.length}</span>
              </span>
              <ChevronDown size={15} className={cn("text-neutral-400 transition-transform", spamOpen && "rotate-180")} />
            </button>
            <button type="button" onClick={handleClearAllSpam} disabled={clearing} className="text-[13px] font-semibold text-neutral-700 disabled:opacity-50">
              {clearing ? "Clearing…" : "Clear all"}
            </button>
          </div>
          {spamOpen && (
            <div className="divide-y divide-neutral-100">
              {spamConversations.map((c) => (
                <SpamInboxRow key={c.contact.id} conversation={c} openRowId={openRowId} onOpenChange={setOpenRowId} onCleared={() => router.refresh()} />
              ))}
            </div>
          )}
        </div>
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
