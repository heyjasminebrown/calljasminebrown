"use client";

import { useState } from "react";
import Link from "next/link";

type SendResult = { ok: boolean; error?: string };

// Shared row for "This month" (anniversaries/birthdays) and Review
// requests - both need the same shape: a draft you can read before it
// goes anywhere, a channel choice, one Send that fires for this contact
// only. onSend is a server action already bound to the right contact (and
// deal, for review requests) by the page - this component only supplies
// the channel/message the person actually chose.
export function DraftMessageRow({
  contactId,
  name,
  meta,
  phone,
  email,
  defaultDraft,
  onSend,
  extra,
}: {
  contactId: string;
  name: string;
  meta: string;
  phone: string | null;
  email: string | null;
  defaultDraft: string;
  onSend: (channel: "email" | "text", to: string, message: string) => Promise<SendResult>;
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultDraft);
  const [channel, setChannel] = useState<"email" | "text">(phone ? "text" : "email");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    const to = channel === "text" ? phone : email;
    if (!to) return;
    setSending(true);
    setError("");
    const result = await onSend(channel, to, message);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.error ?? "Couldn't send that.");
  }

  return (
    <div className="border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/contacts/${contactId}`} className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-6 text-neutral-900">{name}</p>
          <p className="truncate text-[15px] leading-[22px] text-neutral-600">{meta}</p>
        </Link>
        {sent ? (
          <span className="shrink-0 text-sm font-medium text-neutral-500">Sent.</span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800"
            >
              See draft
            </button>
            {extra}
          </div>
        )}
      </div>

      {open && !sent && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-[#fcfbfa] p-3.5">
          {phone && email && (
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setChannel("text")}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${channel === "text" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700"}`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${channel === "email" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700"}`}
              >
                Email
              </button>
            </div>
          )}
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-900"
          />
          {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="rounded-[10px] bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
