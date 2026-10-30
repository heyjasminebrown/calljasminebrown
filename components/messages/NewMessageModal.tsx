"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";
import { X, Search } from "lucide-react";
import { fullName, formatPhone, initials } from "@/lib/utils";
import { useVisualViewportBox } from "@/lib/hooks/useVisualViewportBox";
import { threadHref } from "@/lib/crm/inbox-href";
import type { TextableContact } from "@/lib/data/messages";

export function NewMessageModal({ contacts, onClose }: { contacts: TextableContact[]; onClose: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const { height, top } = useVisualViewportBox();

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fullName(c).toLowerCase().includes(q) || (c.phone ?? "").includes(q);
  });

  function pick(id: string) {
    router.push(
      threadHref(id, {
        filter: searchParams.get("filter"),
        hidden: searchParams.get("hidden") === "1",
        spam: searchParams.get("spam") === "1",
      }),
    );
    onClose();
  }

  return (
    <div className="fixed inset-x-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" style={{ top, height }}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">New message</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input autoFocus placeholder="Search by name or phone" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No matching contacts.</p>}
          {filtered.slice(0, 50).map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-neutral-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                {initials(c.first_name, c.last_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">{fullName(c)}</p>
                <p className="truncate text-xs text-neutral-400">{formatPhone(c.phone)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
