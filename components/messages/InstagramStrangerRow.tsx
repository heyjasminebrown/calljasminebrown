"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { addInstagramContact, matchInstagramSender, sendInstagramDirectMessage } from "@/app/(app)/messages/instagram-actions";
import { relativeTime } from "@/lib/format-time";
import { fullName, formatPhone } from "@/lib/utils";
import { Input, Button, Textarea } from "@/components/ui";
import type { InstagramThread } from "@/lib/data/instagram";
import type { MergeCandidate } from "@/lib/data/contacts";

const REGISTRATION_LINK = "https://www.eventbrite.com/cc/house-hacking-atl-4861227";

export function InstagramStrangerRow({ thread, contacts }: { thread: InstagramThread; contacts: MergeCandidate[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "search" | "new" | "link">("idle");
  const [query, setQuery] = useState("");
  const [newFirstName, setNewFirstName] = useState(thread.igName?.split(" ")[0] ?? "");
  const [newLastName, setNewLastName] = useState(thread.igName?.split(" ").slice(1).join(" ") ?? "");
  const [linkMessage, setLinkMessage] = useState(`Hey! Thanks for reaching out - here's the link to register: ${REGISTRATION_LINK}`);
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [matched, setMatched] = useState(false);

  const handle = thread.igUsername ? `@${thread.igUsername}` : thread.igName || "Someone new";

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return fullName(c).toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  async function handleMatch(contactId: string) {
    setBusy(true);
    const result = await matchInstagramSender(thread.igSenderId, contactId);
    setBusy(false);
    if (result.ok) {
      setMatched(true);
      router.refresh();
    }
  }

  async function handleCreate() {
    setBusy(true);
    const result = await addInstagramContact(thread.igSenderId, newFirstName, newLastName);
    setBusy(false);
    if (result.ok) {
      setMatched(true);
      router.refresh();
    }
  }

  async function handleSendLink() {
    setBusy(true);
    const result = await sendInstagramDirectMessage(thread.igSenderId, linkMessage);
    setBusy(false);
    if (result.ok) setLinkSent(true);
  }

  if (matched) {
    return <div className="border-t border-neutral-100 px-4 py-3.5 text-sm text-neutral-400 first:border-t-0">Matched. Their DMs now show up on their page.</div>;
  }

  return (
    <div className="border-t border-neutral-100 px-4 py-3.5 first:border-t-0">
      <p className="flex items-baseline gap-2 text-[15px]">
        <span className="font-semibold text-neutral-900">{handle}</span>
        <span className="text-neutral-400">{relativeTime(thread.lastMessageAt)}</span>
      </p>
      <p className="mt-0.5 truncate text-[15px] text-neutral-600">&ldquo;{thread.lastMessage}&rdquo;</p>
      <p className="mt-0.5 text-sm text-neutral-400">
        Instagram DM · not in your CRM yet{thread.messageCount > 1 ? ` · ${thread.messageCount} messages` : ""}
      </p>

      {mode === "idle" && (
        <div className="mt-2.5 rounded-xl border border-dashed border-neutral-300 p-3">
          <p className="text-sm text-neutral-500">Save as a contact with lead source Instagram, or send them the registration link.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setMode("search")}>
              <Search size={14} /> Add contact
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMode("link")}>
              Send the link
            </Button>
          </div>
        </div>
      )}

      {mode === "search" && (
        <div className="mt-2.5">
          <div className="flex gap-2">
            <Input placeholder="First name" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
            <Input placeholder="Last name" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
          </div>
          <Button size="sm" className="mt-2" onClick={handleCreate} disabled={busy || !newFirstName.trim()}>
            {busy ? "Creating…" : "Create new contact"}
          </Button>
          <p className="mb-1 mt-3 text-sm text-neutral-500">Or match to someone already in your CRM:</p>
          <Input placeholder="Search by name, phone, or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-1.5 max-h-52 space-y-1 overflow-y-auto">
            {filtered.slice(0, 20).map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => handleMatch(c.id)}
                className="flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                <span className="font-medium text-neutral-900">{fullName(c)}</span>
                <span className="text-xs text-neutral-400">{formatPhone(c.phone) || c.email || "No contact info"}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMode("idle")} className="mt-1.5 text-sm text-neutral-400">
            Cancel
          </button>
        </div>
      )}

      {mode === "link" && (
        <div className="mt-2.5 rounded-xl border border-neutral-200 bg-[#fcfbfa] p-3.5">
          {linkSent ? (
            <p className="text-sm font-medium text-neutral-500">Sent.</p>
          ) : (
            <>
              <Textarea rows={3} value={linkMessage} onChange={(e) => setLinkMessage(e.target.value)} />
              <div className="mt-2.5 flex gap-2">
                <Button size="sm" onClick={handleSendLink} disabled={busy || !linkMessage.trim()}>
                  {busy ? "Sending…" : "Send"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setMode("idle")} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
