"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergeContacts } from "@/app/(app)/contacts/actions";
import { Button, Input } from "@/components/ui";
import { X, Search } from "lucide-react";
import { fullName, formatPhone } from "@/lib/utils";
import type { MergeCandidate } from "@/lib/data/contacts";

export function MergeContactModal({
  contactId,
  contactName,
  candidates,
  onClose,
}: {
  contactId: string;
  contactName: string;
  candidates: MergeCandidate[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");

  const others = candidates.filter((c) => c.id !== contactId);
  const filtered = others.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fullName(c).toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  async function handleMerge() {
    if (!target) return;
    setMerging(true);
    setError("");
    const result = await mergeContacts(target.id, contactId);
    if (!result.ok) {
      setError(result.error);
      setMerging(false);
      return;
    }
    router.push(`/contacts/${target.id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Merge contact</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        {target ? (
          <div className="mt-3">
            <p className="text-sm text-neutral-600">
              Merge <span className="font-medium text-neutral-900">{contactName}</span> into{" "}
              <span className="font-medium text-neutral-900">{fullName(target)}</span>?
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Every call, text, email, deal, task, note, and tag from {contactName} moves to {fullName(target)}. This contact
              ({contactName}) is then deleted. {fullName(target)} keeps its own info for anything already on file; only blank
              fields get filled in from {contactName}.
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-4 flex gap-3">
              <Button onClick={handleMerge} disabled={merging} className="flex-1">
                {merging ? "Merging…" : "Merge"}
              </Button>
              <Button variant="secondary" onClick={() => setTarget(null)} disabled={merging}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mt-3">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                autoFocus
                placeholder="Search by name, phone, or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {filtered.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No matching contacts.</p>}
              {filtered.slice(0, 50).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTarget(c)}
                  className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left text-sm hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{fullName(c)}</span>
                  <span className="text-xs text-neutral-400">{formatPhone(c.phone) || c.email || "No contact info"}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
