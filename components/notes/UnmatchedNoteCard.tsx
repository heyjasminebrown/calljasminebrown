"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { matchNoteToContact, createContactFromNote } from "@/app/(app)/notes/actions";
import { relativeTime } from "@/lib/format-time";
import { fullName, formatPhone } from "@/lib/utils";
import { Input, Button } from "@/components/ui";
import type { UnmatchedNote } from "@/lib/data/notes-inbox";
import type { MergeCandidate } from "@/lib/data/contacts";

export function UnmatchedNoteCard({ note, contacts }: { note: UnmatchedNote; contacts: MergeCandidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "search" | "new">("idle");
  const [query, setQuery] = useState("");
  const [newFirstName, setNewFirstName] = useState(note.participantNames[0]?.split(" ")[0] ?? "");
  const [newLastName, setNewLastName] = useState(note.participantNames[0]?.split(" ").slice(1).join(" ") ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState(false);

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return fullName(c).toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  async function confirmMatch(contactId: string, name: string) {
    setBusy(true);
    const result = await matchNoteToContact(note.id, contactId, name);
    setBusy(false);
    if (result.ok) {
      setMatched(true);
      router.refresh();
    }
  }

  async function handleCreate() {
    setBusy(true);
    const result = await createContactFromNote(note.id, newFirstName, newLastName, newEmail.trim() || null);
    setBusy(false);
    if (result.ok) {
      setMatched(true);
      router.refresh();
    }
  }

  if (matched) {
    return <div className="border-t border-neutral-100 px-4 py-3.5 text-sm text-neutral-400 first:border-t-0">Matched. It&apos;ll show up on their page shortly.</div>;
  }

  return (
    <div className="border-t border-neutral-100 px-4 py-3.5 first:border-t-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <p className="text-[15px] text-neutral-500">{relativeTime(note.occurredAt)}</p>
        <p className="mt-0.5 text-[15px] leading-[22px] text-neutral-800">{note.preview}</p>
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {note.candidates.length > 0 && mode === "idle" && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Who was this with?</p>
              <div className="space-y-1.5">
                {note.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => confirmMatch(c.id, c.name)}
                    className="flex w-full items-center justify-between rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm disabled:opacity-50"
                  >
                    <span className="font-medium text-neutral-900">{c.name}</span>
                    <span className="font-semibold text-brand-600">That&apos;s her</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setMode("search")}>
                <Search size={14} /> Find contact
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setMode("new")}>
                New contact from this note
              </Button>
            </div>
          )}

          {mode === "search" && (
            <div>
              <Input autoFocus placeholder="Search by name, phone, or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="mt-1.5 max-h-52 space-y-1 overflow-y-auto">
                {filtered.slice(0, 20).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy}
                    onClick={() => confirmMatch(c.id, fullName(c))}
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

          {mode === "new" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="First name" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                <Input placeholder="Last name" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              </div>
              <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={busy || !newFirstName.trim()}>
                  {busy ? "Creating…" : "Create & match"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMode("idle")} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
