"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendTextToContact, sendEmailToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";

// Merges SendTextForm/SendEmailForm behind one Text/Email toggle instead
// of two always-open forms stacked on the page - lives inside the
// "Send a message" Section on the contact detail page. Keeps each form's
// own guard (hide the channel a contact has no address for; hide the
// whole card if neither exists, handled by the caller).
export function SendMessageCard({
  contactId,
  phone,
  email,
  firstName,
  lastName,
  initialBody,
}: {
  contactId: string;
  phone: string | null;
  email: string | null;
  firstName?: string;
  lastName?: string;
  initialBody?: string;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<"text" | "email">(phone ? "text" : "email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || (channel === "email" && !subject.trim())) return;
    setSending(true);
    setError("");

    const result =
      channel === "text"
        ? await sendTextToContact(
            contactId,
            phone as string,
            applyMergeFields(body, { first_name: firstName ?? "", last_name: lastName ?? "" }).trim(),
          )
        : await sendEmailToContact(contactId, email as string, subject.trim(), body.trim());

    if (!result.ok) {
      setError(result.error);
      setSending(false);
      return;
    }

    setSubject("");
    setBody("");
    setSending(false);
    router.refresh();
  }

  return (
    <div className="p-[18px]">
      {phone && email && (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setChannel("text")}
            className={`rounded-[10px] px-3.5 py-2 text-sm font-semibold ${channel === "text" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600"}`}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`rounded-[10px] px-3.5 py-2 text-sm font-semibold ${channel === "email" ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600"}`}
          >
            Email
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-2.5">
        {channel === "email" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-[11px] border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-[15px] text-neutral-900"
          />
        )}
        <div className="flex items-end gap-2.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={channel === "text" ? "Write a text…" : "Write an email…"}
            rows={channel === "text" ? (initialBody ? 3 : 2) : 3}
            className="min-w-0 flex-1 rounded-[11px] border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-[15px] text-neutral-900"
          />
          <button
            type="submit"
            disabled={sending || !body.trim() || (channel === "email" && !subject.trim())}
            className="shrink-0 rounded-[11px] bg-brand-600 p-3.5 text-white disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
