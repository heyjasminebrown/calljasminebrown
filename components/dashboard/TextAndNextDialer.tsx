"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Info, MessageCircle, Phone, SkipForward } from "lucide-react";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { leadAgeLabel, type TextAndNextLead } from "@/lib/crm/today-v1";
import { cn, formatPhone, initials } from "@/lib/utils";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";

export function TextAndNextDialer({ leads }: { leads: TextAndNextLead[] }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const queue = useMemo(() => leads.filter((lead) => !hiddenIds.has(lead.id)), [leads, hiddenIds]);
  const current = queue[0] ?? null;
  const total = leads.length;
  const position = current ? total - queue.length + 1 : 0;
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

  function skip() {
    if (!current) return;
    hide(current.id);
  }

  return (
    <section data-today-home="text-and-next" className={cn("overflow-hidden p-4 lg:p-6", TODAY_CARD)}>
      <div className="flex items-center gap-2.5">
        <h2 className="text-[15px] font-semibold text-neutral-900">New / Uncontacted</h2>
        {total > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#c45c4a] px-2 text-[12px] font-semibold text-white">
            {queue.length}
          </span>
        )}
      </div>

      {!current ? (
        <p className="mt-4 text-[15px] leading-6 text-neutral-500 lg:mt-5">
          No new leads waiting for a first text. You&apos;re caught up.
        </p>
      ) : (
        <div className="mt-4 grid min-w-0 gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-6 xl:gap-10">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3e4dc] font-serif text-[18px] font-semibold text-[#c45c4a] lg:h-14 lg:w-14 lg:text-[22px]">
                {initials(current.firstName, current.lastName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="truncate font-serif text-[18px] font-semibold leading-6 text-neutral-900 lg:text-[22px] lg:leading-7">
                    {current.name}
                  </p>
                  <span className="rounded-full bg-[#f3e4dc] px-2.5 py-0.5 text-[12px] font-medium text-[#c45c4a]">
                    {current.sourceChip}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-neutral-500 lg:text-[14px]">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={14} strokeWidth={1.75} className="text-[#c45c4a]" />
                    {current.phone ? formatPhone(current.phone) : "No phone on file"}
                  </span>
                  <span className="text-[#c45c4a]">·</span>
                  <span>{leadAgeLabel(current.leadDate)}</span>
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[13px] leading-5 text-neutral-500">
              <Info size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-neutral-400" />
              {current.autoFillNote}
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-2.5 hidden items-center gap-2 text-[15px] font-semibold text-neutral-800 lg:flex">
              <MessageCircle size={16} strokeWidth={1.7} className="text-[#c45c4a]" />
              Text &amp; Next
            </p>
            <textarea
              key={current.id}
              value={body}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              data-today-control="text-next-draft"
              className="min-h-[88px] w-full resize-none rounded-[14px] border border-[#eadfd6] bg-[#fffdfb] px-3.5 py-3 text-[14px] leading-6 text-neutral-800 outline-none focus:border-[#c45c4a]/50 focus:ring-2 focus:ring-[#c45c4a]/15 lg:min-h-[112px]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-today-control="send-and-next"
                onClick={() => void sendAndNext()}
                disabled={!current.phone || sending || !body.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#c45c4a] px-3.5 text-[13px] font-semibold text-white shadow-[0_4px_10px_rgb(196_92_74_/_0.28)] disabled:opacity-50 lg:h-11 lg:px-4 lg:text-[14px]"
              >
                {sending ? "Sending…" : "Send & next"}
                {!sending && <ArrowRight size={15} />}
              </button>
              <button
                type="button"
                data-today-control="skip-lead"
                onClick={skip}
                disabled={sending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#eadfd6] bg-[#fffbf8] px-3 text-[13px] font-semibold text-neutral-700 disabled:opacity-50 lg:h-11 lg:px-3.5 lg:text-[14px]"
              >
                <SkipForward size={14} />
                Skip
              </button>
              <Link href="/settings#text-templates" data-today-control="edit-template" className="ml-auto text-[13px] font-medium text-[#c45c4a]">
                Edit template
              </Link>
            </div>
            {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
            <div className="mt-3 flex items-center justify-end gap-3 lg:mt-4">
              <p className="text-[13px] text-neutral-400">
                {position} of {total}
              </p>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-[#eadfd6] lg:w-24">
                <div
                  className="h-full rounded-full bg-[#c45c4a]"
                  style={{ width: `${total === 0 ? 0 : (position / total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
