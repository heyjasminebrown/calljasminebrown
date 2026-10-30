"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check, MessageSquare } from "lucide-react";
import { createContactBookingLink } from "@/app/(app)/scheduling/actions";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { buildSchedulingLinkMessage } from "@/lib/crm/booking-message";
import { Button } from "@/components/ui";

export function SchedulingLinkModal({
  contactId,
  firstName,
  phone,
  onClose,
}: {
  contactId: string;
  firstName: string;
  phone: string | null;
  onClose: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createContactBookingLink(contactId).then((res) => {
      if (cancelled) return;
      if (res.ok) setLink(res.link);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendText() {
    if (!link || !phone) return;
    setSending(true);
    setError("");
    const message = buildSchedulingLinkMessage({ firstName: firstName || "there", link });
    const result = await sendTextToContact(contactId, phone, message);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.error ?? "Couldn't send that text.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <p className="font-serif text-xl font-semibold text-neutral-900">Scheduling link</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!link && !error && <p className="text-sm text-neutral-500">Getting your link…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {link && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">{link}</span>
                <Button variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-neutral-400">
                Prefilled with {firstName || "their"} info - they just pick a time and confirm.
              </p>
              <Button onClick={sendText} disabled={!phone || sending || sent} className="w-full">
                <MessageSquare size={15} /> {sent ? "Sent" : sending ? "Sending…" : "Send as a text"}
              </Button>
              {!phone && <p className="text-xs text-neutral-400">No phone on file - copy the link instead.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
