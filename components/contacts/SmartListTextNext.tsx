"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Sun, X } from "lucide-react";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { buildSmartListTextNextLeads } from "@/lib/crm/smart-lists";
import { cn, formatPhone, initials } from "@/lib/utils";
import type { ContactWithRelations } from "@/types/database";

export function SmartListTextNext({
  contacts,
  listName,
  onClose,
}: {
  contacts: ContactWithRelations[];
  listName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const leads = useMemo(() => buildSmartListTextNextLeads(contacts), [contacts]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const queue = leads.filter((lead) => !hiddenIds.has(lead.id));
  const current = queue[0] ?? null;
  const body = draft ?? current?.draft ?? "";

  function hide(id: string) {
    setHiddenIds((prev) => new Set(prev).add(id));
    setDraft(null);
    setError("");
  }

  async function sendAndNext() {
    if (!current?.phone || !body.trim()) return;
    setSending(true);
    setError("");
    const result = await sendTextToContact(
      current.id,
      current.phone,
      applyMergeFields(body, { first_name: current.firstName, last_name: current.lastName }).trim(),
    );
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    hide(current.id);
    router.refresh();
  }

  return (
    <aside className="sticky top-[88px] hidden h-[calc(100dvh-110px)] w-[300px] shrink-0 self-start overflow-hidden lg:block">
      <div className="flex h-full flex-col border-l border-[#eadfd6] bg-[#fffbf8]">
        <div className="flex items-center justify-between gap-3 border-b border-[#eadfd6] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sun size={16} className="shrink-0 text-[#c45c4a]" />
            <p className="truncate font-serif text-lg font-semibold text-neutral-900">Today · Do next</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-[#f3e4dc]" aria-label="Close Text & Next">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="font-serif text-[22px] font-semibold leading-7 text-neutral-900">{listName}</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            {queue.length} with phone{queue.length === 1 ? "" : "s"}
          </p>

          {!current ? (
            <p className="mt-6 text-[14px] leading-6 text-neutral-500">No one left to text in this smart list.</p>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3e4dc] text-[12px] font-semibold text-[#c45c4a]">
                  {initials(current.firstName, current.lastName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{current.name}</p>
                  <p className="text-[12px] text-neutral-400">{current.phone ? formatPhone(current.phone) : "No phone"}</p>
                </div>
              </div>
              <p className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">Text</p>
              <textarea
                key={current.id}
                value={body}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                className="w-full resize-none rounded-[14px] border border-[#eadfd6] bg-[#fffdfb] px-3.5 py-3 text-[14px] leading-6 text-neutral-800 outline-none focus:border-[#c45c4a]/50 focus:ring-2 focus:ring-[#c45c4a]/15"
              />
              {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[#eadfd6] px-5 py-4">
          <button
            type="button"
            onClick={() => current && hide(current.id)}
            disabled={!current}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#eadfd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-neutral-600 disabled:opacity-40"
          >
            <Clock size={14} /> Snooze
          </button>
          <button
            type="button"
            onClick={() => void sendAndNext()}
            disabled={!current?.phone || sending || !body.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#c45c4a] px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {sending ? "Sending…" : "Next"}
            {!sending && <ArrowRight size={14} />}
          </button>
          <button
            type="button"
            onClick={() => current && hide(current.id)}
            disabled={!current}
            className={cn("col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#eadfd6] bg-white px-3 py-2.5 text-[13px] font-semibold text-neutral-600 disabled:opacity-40")}
          >
            <X size={14} /> Dismiss
          </button>
        </div>
      </div>
    </aside>
  );
}
