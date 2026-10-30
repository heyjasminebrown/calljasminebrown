"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { addToConfirmationList, searchContactsToConfirm } from "@/app/(app)/dialer/actions";
import { formatPhone } from "@/lib/utils";
import type { ConfirmationSearchResult, UpcomingConfirmationEvent } from "@/lib/data/dialer";

function formatEventStart(eventStart: string): string {
  return new Date(eventStart).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Confirm-attendance only: a person she knows is coming who never
// registered. Extracted unchanged from the old ConfirmationQueue so the
// unified DialerWorkspace can show it above the queue for that mode only.
export function AddSomeoneCard({ events, onClose, onAdded }: { events: UpcomingConfirmationEvent[]; onClose: () => void; onAdded: () => void }) {
  const [eventId, setEventId] = useState(events[0].eventId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConfirmationSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    setError(null);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const found = await searchContactsToConfirm(q);
    setSearching(false);
    setResults(found);
  }

  async function add(contactId: string) {
    const event = events.find((e) => e.eventId === eventId);
    if (!event) return;
    setAddingId(contactId);
    setError(null);
    const result = await addToConfirmationList(contactId, event.eventId, event.eventName);
    setAddingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAdded();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-800">Add someone to confirm</p>
        <button onClick={onClose} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100">
          <X size={16} />
        </button>
      </div>

      {events.length > 1 && (
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="mt-2 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
          {events.map((e) => (
            <option key={e.eventId} value={e.eventId}>
              {e.eventName} · {formatEventStart(e.eventStart)}
            </option>
          ))}
        </select>
      )}

      <div className="relative mt-2">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by name"
          className="w-full rounded-lg border border-neutral-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-400"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {query.trim().length >= 2 && (
        <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
          {searching && <p className="px-1 py-2 text-xs text-neutral-400">Searching…</p>}
          {!searching && results?.length === 0 && <p className="px-1 py-2 text-xs text-neutral-400">No matching contacts.</p>}
          {results?.map((r) => (
            <button
              key={r.id}
              onClick={() => add(r.id)}
              disabled={addingId === r.id}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              <span>
                <span className="font-medium text-neutral-800">{r.name}</span>
                {r.phone && <span className="ml-2 text-xs text-neutral-400">{formatPhone(r.phone)}</span>}
              </span>
              {addingId === r.id && <span className="text-xs text-neutral-400">Adding…</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
