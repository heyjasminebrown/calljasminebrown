"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { X, Search } from "lucide-react";
import { fullName } from "@/lib/utils";

type SimpleContact = { id: string; first_name: string; last_name: string; email: string | null };

export function EnrollContactModal({
  sequenceId,
  candidates,
  onClose,
}: {
  sequenceId: string;
  candidates: SimpleContact[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = candidates.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fullName(c).toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  async function enroll(contactId: string) {
    setSaving(contactId);
    setError(null);
    const supabase = createClient();
    const { error: enrollError } = await supabase.from("email_sequence_enrollments").insert({ sequence_id: sequenceId, contact_id: contactId });
    setSaving(null);
    if (enrollError) {
      setError(enrollError.message);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Enroll a contact</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            autoFocus
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {error && <p className="mt-2 text-sm font-medium text-red-600">Couldn&apos;t enroll: {error}</p>}
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No matching contacts.</p>}
          {filtered.slice(0, 50).map((c) => (
            <button
              key={c.id}
              onClick={() => enroll(c.id)}
              disabled={saving === c.id}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              <span>
                <span className="font-medium text-neutral-900">{fullName(c)}</span>
                {c.email && <span className="ml-2 text-neutral-400">{c.email}</span>}
              </span>
              {saving === c.id && <span className="text-xs text-neutral-400">Adding…</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
