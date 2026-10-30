"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { formatInboxPhone, MESSAGES_TERRACOTTA } from "@/lib/crm/messages-v1";
import { useVisualViewportBox } from "@/lib/hooks/useVisualViewportBox";

export function InboxComposer({
  contactId,
  phone,
  firstName,
  lastName,
  initialBody,
  sticky = false,
}: {
  contactId: string;
  phone: string | null;
  firstName?: string;
  lastName?: string;
  initialBody?: string;
  sticky?: boolean;
}) {
  const router = useRouter();
  const { keyboardInset } = useVisualViewportBox();
  const [body, setBody] = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const keyboardOpen = keyboardInset > 40;
  const bottom = sticky && keyboardOpen ? `${keyboardInset}px` : undefined;

  useEffect(() => {
    if (initialBody) setBody(initialBody);
  }, [initialBody, contactId]);

  if (!phone) {
    return (
      <div className="border-t border-[#eadfd6] bg-white px-4 py-3 text-center text-xs text-neutral-400">
        This contact has no phone number on file.
      </div>
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !phone) return;
    setSending(true);
    setError("");

    const result = await sendTextToContact(
      contactId,
      phone,
      applyMergeFields(body, { first_name: firstName ?? "", last_name: lastName ?? "" }).trim(),
    );

    if (!result.ok) {
      setError(result.error);
      setSending(false);
      return;
    }

    setBody("");
    setSending(false);
    router.refresh();
  }

  return (
    <div
      className={
        sticky
          ? "fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfd6] bg-white px-4 py-3"
          : "border-t border-[#eadfd6] bg-white px-4 py-3"
      }
      style={bottom != null ? { bottom } : undefined}
    >
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply…"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-full border border-[#eadfd6] bg-white px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-[#C45C3E] focus:outline-none focus:ring-2 focus:ring-[#C45C3E]/15"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="h-11 shrink-0 rounded-full px-5 text-[15px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: MESSAGES_TERRACOTTA }}
        >
          {sending ? "Sending" : "Send"}
        </button>
      </form>
      <p className="mt-2 text-[12px] text-neutral-400">SMS · {formatInboxPhone(phone)}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
