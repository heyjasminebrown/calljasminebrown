"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { sendInstagramDirectMessage } from "@/app/(app)/messages/instagram-actions";
import { Button, Textarea } from "@/components/ui";

export function InstagramMessageModal({ igSenderId, contactName, onClose }: { igSenderId: string; contactName: string; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setSending(true);
    setError("");
    const result = await sendInstagramDirectMessage(igSenderId, message);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Message {contactName} on Instagram</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <p className="mt-4 text-sm font-medium text-neutral-500">Sent - check the thread in a moment.</p>
        ) : (
          <>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a reply…" className="mt-3" />
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
            <Button className="mt-3 w-full" onClick={handleSend} disabled={sending || !message.trim()}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
