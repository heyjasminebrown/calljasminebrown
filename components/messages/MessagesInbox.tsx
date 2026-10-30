"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { InboxThreadPane } from "@/components/messages/InboxThreadPane";
import { InboxThreadRow } from "@/components/messages/InboxThreadRow";
import { inboxHref, threadHref } from "@/lib/crm/inbox-href";
import {
  filterSmsInboxThreads,
  isSmsUnread,
  MESSAGES_TERRACOTTA,
  type MessagesFilter,
  type OpenSmsThread,
  type SmsInboxThread,
} from "@/lib/crm/messages-v1";
import { cn } from "@/lib/utils";

const FILTERS: { key: MessagesFilter; label: string }[] = [
  { key: "needs", label: "Needs reply" },
  { key: "unread", label: "Unread" },
  { key: "all", label: "All" },
];

export function MessagesInbox({
  threads,
  initialSeen,
  filter,
  selected,
  openThread,
  autoSelectFirst = true,
}: {
  threads: SmsInboxThread[];
  initialSeen: Record<string, string>;
  filter: MessagesFilter;
  selected?: string | null;
  openThread?: OpenSmsThread | null;
  autoSelectFirst?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [seen, setSeen] = useState(initialSeen);

  useEffect(() => {
    setSeen(initialSeen);
  }, [initialSeen]);

  useEffect(() => {
    if (!openThread) return;
    setSeen((prev) => ({ ...prev, [openThread.contactId]: new Date().toISOString() }));
  }, [openThread?.contactId]);

  const visible = useMemo(() => {
    const filtered = filterSmsInboxThreads(threads, filter, seen, query);
    if (filter === "unread" && openThread && !filtered.some((thread) => thread.id === openThread.contactId)) {
      const current = threads.find((thread) => thread.id === openThread.contactId);
      if (current && filterSmsInboxThreads([current], "all", {}, query).length > 0) {
        return [current, ...filtered];
      }
    }
    return filtered;
  }, [threads, filter, seen, query, openThread]);

  useEffect(() => {
    if (!autoSelectFirst || selected || openThread) return;
    if (typeof window === "undefined" || window.innerWidth < 1024) return;
    const first = visible[0];
    if (first) router.replace(threadHref(first.id, { filter }));
  }, [autoSelectFirst, selected, openThread, visible, filter, router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("messages-thread-search") as HTMLInputElement | null;
        if (input) {
          input.focus();
          return;
        }
        setMobileSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unreadForPane = !!(openThread && isThreadInitiallyUnread(threads, openThread.contactId, initialSeen));

  if (openThread) {
    return (
      <>
        <div className="lg:hidden">
          <InboxThreadPane thread={openThread} unread={unreadForPane} backHref={inboxHref({ filter })} layout="mobile" />
        </div>
        <div className="hidden h-full min-h-0 lg:block lg:flex-1">
          <InboxChrome
            filter={filter}
            query={query}
            onQuery={setQuery}
            mobileSearchOpen={false}
            onMobileSearch={() => undefined}
            threads={visible}
            selectedId={openThread.contactId}
            seen={seen}
            pane={<InboxThreadPane thread={openThread} unread={unreadForPane} backHref={inboxHref({ filter })} layout="desktop" />}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="lg:hidden">
        <MobileList
          filter={filter}
          query={query}
          onQuery={setQuery}
          mobileSearchOpen={mobileSearchOpen}
          onMobileSearch={setMobileSearchOpen}
          threads={visible}
          seen={seen}
        />
      </div>
      <div className="hidden h-full min-h-0 lg:block lg:flex-1">
        <InboxChrome
          filter={filter}
          query={query}
          onQuery={setQuery}
          mobileSearchOpen={false}
          onMobileSearch={() => undefined}
          threads={visible}
          selectedId={null}
          seen={seen}
          pane={
            <div className="flex h-full items-center justify-center rounded-[20px] border border-[#eadfd6] bg-white text-sm text-neutral-400">
              Select a thread
            </div>
          }
        />
      </div>
    </>
  );
}

function isThreadInitiallyUnread(threads: SmsInboxThread[], contactId: string, seen: Record<string, string>): boolean {
  const thread = threads.find((item) => item.id === contactId);
  return isSmsUnread(thread?.lastInboundAt, seen[contactId]);
}

function FilterBar({ filter }: { filter: MessagesFilter }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((item) => {
        const active = filter === item.key;
        return (
          <Link
            key={item.key}
            href={inboxHref({ filter: item.key })}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium",
              active ? "text-white" : "border border-[#eadfd6] bg-white text-neutral-700",
            )}
            style={active ? { backgroundColor: MESSAGES_TERRACOTTA } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function SearchField({
  id,
  query,
  onQuery,
  shortcut,
}: {
  id?: string;
  query: string;
  onQuery: (value: string) => void;
  shortcut?: boolean;
}) {
  return (
    <label className="flex h-10 min-w-[220px] items-center gap-2 rounded-full border border-[#eadfd6] bg-white px-3.5 text-neutral-400">
      <Search size={16} />
      <input
        id={id}
        name="q"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search threads"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
      />
      {shortcut && <span className="text-[12px] text-neutral-300">⌘K</span>}
    </label>
  );
}

function InboxChrome({
  filter,
  query,
  onQuery,
  threads,
  selectedId,
  seen,
  pane,
}: {
  filter: MessagesFilter;
  query: string;
  onQuery: (value: string) => void;
  mobileSearchOpen: boolean;
  onMobileSearch: (open: boolean) => void;
  threads: SmsInboxThread[];
  selectedId: string | null;
  seen: Record<string, string>;
  pane: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-4 pb-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em] text-neutral-900">Messages</h1>
          <p className="mt-1 text-[15px] text-neutral-500">SMS threads that need you.</p>
        </div>
        <SearchField id="messages-thread-search" query={query} onQuery={onQuery} shortcut />
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-[38%] min-w-0 flex-col">
          <div className="pb-3">
            <FilterBar filter={filter} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-[20px] border border-[#eadfd6] bg-white py-1.5">
            {threads.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-neutral-400">
                {filter === "needs" ? "Nothing needs a reply." : filter === "unread" ? "No unread threads." : "No SMS threads yet."}
              </p>
            ) : (
              threads.map((thread) => (
                <InboxThreadRow
                  key={thread.id}
                  thread={thread}
                  href={threadHref(thread.id, { filter })}
                  selected={thread.id === selectedId}
                  lastSeenAt={seen[thread.id]}
                  layout="desktop"
                />
              ))
            )}
          </div>
        </div>
        <div className="min-h-0 w-[62%] min-w-0">{pane}</div>
      </div>
    </div>
  );
}

function MobileList({
  filter,
  query,
  onQuery,
  mobileSearchOpen,
  onMobileSearch,
  threads,
  seen,
}: {
  filter: MessagesFilter;
  query: string;
  onQuery: (value: string) => void;
  mobileSearchOpen: boolean;
  onMobileSearch: (open: boolean) => void;
  threads: SmsInboxThread[];
  seen: Record<string, string>;
}) {
  return (
    <div className="bg-[#F7F1E8] pb-4">
      <div className="flex items-start justify-between gap-3 px-4 pt-5 pb-3">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.02em] text-neutral-900">Messages</h1>
          <p className="mt-1 text-[15px] text-neutral-500">SMS threads that need you.</p>
        </div>
        <button
          type="button"
          aria-label="Search threads"
          onClick={() => onMobileSearch(!mobileSearchOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500"
        >
          <Search size={20} />
        </button>
      </div>
      {mobileSearchOpen && (
        <div className="px-4 pb-3">
          <SearchField id="messages-thread-search" query={query} onQuery={onQuery} />
        </div>
      )}
      <div className="px-4 pb-3">
        <FilterBar filter={filter} />
      </div>
      <div className="divide-y divide-[#f0e8df] bg-white">
        {threads.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            {filter === "needs" ? "Nothing needs a reply." : filter === "unread" ? "No unread threads." : "No SMS threads yet."}
          </p>
        ) : (
          threads.map((thread) => (
            <InboxThreadRow
              key={thread.id}
              thread={thread}
              href={threadHref(thread.id, { filter })}
              selected={false}
              lastSeenAt={seen[thread.id]}
              layout="mobile"
            />
          ))
        )}
      </div>
    </div>
  );
}
