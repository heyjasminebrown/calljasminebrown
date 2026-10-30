"use client";

import { useRef } from "react";
import { Bold, Underline, Link as LinkIcon } from "lucide-react";
import { Textarea } from "@/components/ui";

const TOOLBAR_BTN = "flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100";

// A plain textarea can't apply live rich-text formatting, but the send
// pipeline (textToHtml in lib/google/send-email.ts) never strips or
// escapes HTML out of the body - so wrapping the selection in real
// <b>/<u>/<a> tags here is enough to make it actually render that way in
// the sent email, without building a full rich-text editor.
export function EmailBodyEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after: string, fallback: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    wrap(`<a href="${url}">`, "</a>", "link text");
  }

  return (
    <div>
      <div className="mb-1 flex gap-1">
        <button type="button" onClick={() => wrap("<b>", "</b>", "bold text")} className={TOOLBAR_BTN} aria-label="Bold" title="Bold">
          <Bold size={13} />
        </button>
        <button type="button" onClick={() => wrap("<u>", "</u>", "underlined text")} className={TOOLBAR_BTN} aria-label="Underline" title="Underline">
          <Underline size={13} />
        </button>
        <button type="button" onClick={addLink} className={TOOLBAR_BTN} aria-label="Insert link" title="Insert link">
          <LinkIcon size={13} />
        </button>
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} rows={rows} placeholder={placeholder} />
    </div>
  );
}
