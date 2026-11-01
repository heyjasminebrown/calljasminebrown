"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { sendEmailToContact } from "@/app/(app)/contacts/actions";

// Sends from the connected Gmail account and logs the email on the
// contact's timeline - used by every "Email" button on a contact instead
// of a mailto: link, which opened whatever desktop mail app was installed.
export function EmailComposeModal({
  contactId,
  email,
  contactName,
  onClose,
}: {
  contactId: string;
  email: string;
  contactName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError("");
    const result = await sendEmailToContact(contactId, email, subject.trim(), body.trim());
    setSending(false);
    if (!result.ok) {
      setError(`Email not sent: ${result.error}`);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form onSubmit={send} className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-serif text-xl font-semibold text-neutral-900">Email {contactName}</p>
            <p className="truncate text-sm text-neutral-500">To {email} · sends from your Gmail</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-2.5">
          <Input autoFocus placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Write an email…" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-3">
          <Button type="submit" disabled={sending || !subject.trim() || !body.trim()} className="flex-1">
            {sending ? "Sending…" : "Send email"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
