"use client";

import { useState } from "react";
import { Send, Eye, EyeOff, ChevronDown } from "lucide-react";
import { applyMergeFields, PREVIEW_CONTACT, draftToHtml } from "@/lib/crm/merge-fields";
import { MESSAGE_TEMPLATE_CATEGORIES } from "@/lib/crm/text-blast-templates";

// The same three categories the text composer already gets from
// MESSAGE_TEMPLATE_CATEGORIES - email authoring otherwise starts from an
// empty box every time. No event context on this side, so build() gets
// null/null and falls back to generic "the meetup" phrasing.
export function EmailTemplateButtons({ onPick }: { onPick: (body: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {MESSAGE_TEMPLATE_CATEGORIES.map((category) => (
        <div key={category.key} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => (v === category.key ? null : category.key))}
            className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700"
          >
            {category.label} templates <ChevronDown size={13} className="text-neutral-400" />
          </button>
          {open === category.key && (
            <>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="fixed inset-0 z-30 cursor-default" />
              <div className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                {category.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      onPick(option.build(null, null));
                      setOpen(null);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Preview + Send test, styled identically everywhere an email gets
// authored - previously only CreateSequenceForm's batch branch had these;
// a scheduled sequence or drip step was authored blind.
export function EmailPreviewTest({
  subject,
  body,
  onSendTest,
}: {
  subject: string;
  body: string;
  onSendTest: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    const result = await onSendTest();
    setTesting(false);
    setTestResult({ ok: result.ok, message: result.ok ? "Sent to your inbox" : (result.error ?? "Couldn't send") });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={testing || !subject.trim() || !body.trim()}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-brand-600 disabled:opacity-50"
        >
          <Send size={13} /> {testing ? "Sending…" : "Send test to myself"}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          disabled={!subject.trim() && !body.trim()}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-brand-600 disabled:opacity-50"
        >
          {showPreview ? <EyeOff size={13} /> : <Eye size={13} />} {showPreview ? "Hide preview" : "Preview email"}
        </button>
        {testResult && <span className={`text-xs ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>{testResult.message}</span>}
      </div>
      {showPreview && (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-400">
            As {PREVIEW_CONTACT.first_name} {PREVIEW_CONTACT.last_name} would see it
          </div>
          <div className="p-4">
            <p className="mb-2 border-b border-neutral-100 pb-2 text-sm font-semibold text-neutral-900">
              {applyMergeFields(subject, PREVIEW_CONTACT) || "(no subject)"}
            </p>
            {/* eslint-disable-next-line react/no-danger -- her own authored draft, rendered exactly as it will be sent (same textToHtml transform) */}
            <div
              className="text-sm leading-relaxed text-neutral-800"
              dangerouslySetInnerHTML={{ __html: draftToHtml(applyMergeFields(body, PREVIEW_CONTACT)) || "<p class='text-neutral-400'>(empty)</p>" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
