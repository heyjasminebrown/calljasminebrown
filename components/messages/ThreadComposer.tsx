"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { useVisualViewportBox } from "@/lib/hooks/useVisualViewportBox";
import { Send } from "lucide-react";
import type { TextTemplate } from "@/types/database";

export function ThreadComposer({
  contactId,
  phone,
  firstName,
  lastName,
  textTemplates,
  initialBody,
}: {
  contactId: string;
  phone: string | null;
  firstName?: string;
  lastName?: string;
  textTemplates?: TextTemplate[];
  initialBody?: string;
}) {
  const router = useRouter();
  const { keyboardInset } = useVisualViewportBox();
  const [body, setBody] = useState(initialBody ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const keyboardOpen = keyboardInset > 40;
  const bottom = keyboardOpen ? `max(${keyboardInset}px, var(--app-bottom-nav))` : undefined;
  const prefilled = !!(body || initialBody)?.trim();

  useEffect(() => {
    if (initialBody) setBody(initialBody);
  }, [initialBody, contactId]);

  const chrome =
    "fixed inset-x-0 z-50 border-t border-[#eadfd6] bg-[#fffbf8]/95 px-3 py-2.5 backdrop-blur lg:sticky lg:bottom-0 lg:bg-[#fffbf8]/95";

  if (!phone) {
    return (
      <div
        className={`${chrome} bottom-[var(--app-bottom-nav)] px-4 py-3 text-center text-xs text-neutral-400 lg:relative lg:bottom-0`}
        style={bottom != null ? { bottom } : undefined}
      >
        This contact has no phone number on file.
      </div>
    );
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");

    const result = await sendTextToContact(
      contactId,
      phone as string,
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
      className={`${chrome} bottom-[var(--app-bottom-nav)]`}
      style={bottom != null ? { bottom } : undefined}
    >
      {textTemplates && textTemplates.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto lg:hidden">
          {textTemplates.slice(0, 3).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setBody(applyMergeFields(t.body, { first_name: firstName ?? "", last_name: "" }))}
              className="h-9 shrink-0 whitespace-nowrap rounded-full border border-neutral-200 px-3 text-[13px] font-medium text-neutral-600"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Text message"
          rows={prefilled ? 3 : 1}
          className={`max-h-28 flex-1 resize-none border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${prefilled ? "rounded-[16px]" : "rounded-full"}`}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </form>
      {error && <p className="mt-1 px-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
