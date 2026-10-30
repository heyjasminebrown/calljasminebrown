"use client";

import { useEffect, useState } from "react";
import { X, MessageSquareText, Send, Users, AlertTriangle, ChevronDown, ChevronUp, Undo2 } from "lucide-react";
import { Button, Textarea, Input } from "@/components/ui";
import { applyMergeFields, PREVIEW_CONTACT, usesFirstNameMergeField } from "@/lib/crm/merge-fields";
import { MESSAGE_TEMPLATE_CATEGORIES, type MessageTemplateCategory } from "@/lib/crm/text-blast-templates";
import { estimatedTextBlastMinutes, isWithinQuietHours, quietHoursEndLabel } from "@/lib/crm/text-blast-timing";
import { tagBlastLabel } from "@/lib/crm/text-blasts";
import { relativeTime } from "@/lib/format-time";
import {
  createTagTextBlast,
  createContactsTextBlast,
  cancelTextBlast,
  getTextBlastsForEvent,
  getTagAudiencePreview,
  getContactsAudiencePreview,
  sendTestText,
  getTextBlastFailureDetails,
  retryFailedTextBlastRecipients,
  type TextBlastWithProgress,
  type TextBlastFailureGroup,
  type TextBlastAudiencePreview,
  type BlastTarget,
} from "@/app/(app)/contacts/text-blast-actions";

function blastLabel(target: BlastTarget): string {
  if (target.kind === "tag") return tagBlastLabel(target.tagName);
  return target.label;
}

function blastTitle(target: BlastTarget): string {
  if (target.kind === "tag") return "Text a tag";
  return "Text selected contacts";
}

export function TextBlastModal({ target, onClose }: { target: BlastTarget; onClose: () => void }) {
  const label = blastLabel(target);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: true; recipientCount: number } | { ok: false; error: string } | null>(null);
  const [history, setHistory] = useState<TextBlastWithProgress[] | null>(null);
  const [failureDetails, setFailureDetails] = useState<Record<string, TextBlastFailureGroup[]>>({});
  const [expandedFailures, setExpandedFailures] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function toggleFailures(blastId: string) {
    if (expandedFailures === blastId) {
      setExpandedFailures(null);
      return;
    }
    setExpandedFailures(blastId);
    if (!failureDetails[blastId]) {
      const groups = await getTextBlastFailureDetails(blastId);
      setFailureDetails((prev) => ({ ...prev, [blastId]: groups }));
    }
  }

  async function retry(blastId: string) {
    setRetrying(blastId);
    await retryFailedTextBlastRecipients(blastId);
    setRetrying(null);
    setExpandedFailures(null);
    setFailureDetails((prev) => {
      const next = { ...prev };
      delete next[blastId];
      return next;
    });
    await loadHistory();
  }

  const [audience, setAudience] = useState<TextBlastAudiencePreview | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  function toggleExcluded(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const [openTemplateCategory, setOpenTemplateCategory] = useState<MessageTemplateCategory["key"] | null>(null);

  const [testPhone, setTestPhone] = useState(() => (typeof window !== "undefined" ? (localStorage.getItem("textBlastTestPhone") ?? "") : ""));
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: true } | { ok: false; error: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sendNowOverride, setSendNowOverride] = useState(false);
  const inQuietHours = isWithinQuietHours();

  async function loadHistory() {
    const blasts = await getTextBlastsForEvent(label);
    setHistory(blasts);
  }

  function loadAudience() {
    setExcludedIds(new Set());
    if (target.kind === "tag") {
      getTagAudiencePreview(target.tagId).then(setAudience);
      return;
    }
    getContactsAudiencePreview(target.contactIds).then(setAudience);
  }

  useEffect(() => {
    loadHistory();
    loadAudience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  async function send() {
    const effectiveCount = (audience?.count ?? 0) - excludedIds.size;
    if (effectiveCount <= 0) return;
    setSending(true);
    const excludeContactIds = [...excludedIds];
    const outcome =
      target.kind === "tag"
        ? await createTagTextBlast(target.tagId, target.tagName, message, excludeContactIds, sendNowOverride)
        : await createContactsTextBlast(target.contactIds, target.label, message, excludeContactIds, sendNowOverride);
    setSending(false);
    setConfirming(false);
    if (outcome.ok) {
      setResult({ ok: true, recipientCount: outcome.recipientCount });
      setMessage("");
      loadHistory();
    } else {
      setResult({ ok: false, error: outcome.error });
    }
  }

  async function sendTest() {
    localStorage.setItem("textBlastTestPhone", testPhone);
    setTestSending(true);
    setTestResult(null);
    const outcome = await sendTestText(message, testPhone);
    setTestSending(false);
    setTestResult(outcome.ok ? { ok: true } : { ok: false, error: outcome.error });
  }

  async function cancel(blastId: string) {
    await cancelTextBlast(blastId);
    loadHistory();
  }

  const preview = message.trim() ? applyMergeFields(message, PREVIEW_CONTACT) : "";
  const duplicateCount = audience?.recipients.filter((r) => r.duplicatePhone || r.duplicateName).length ?? 0;
  const effectiveCount = (audience?.count ?? 0) - excludedIds.size;
  // Only a real problem if the message actually greets by name - a contact
  // whose first_name on file is just their phone number (never a real name)
  // would otherwise get sent "Hi 5739992048," so the send loop skips them
  // instead. Flagged here so she sees who that affects before she sends,
  // not just after.
  const greetsByName = usesFirstNameMergeField(message);
  const noNameCount = greetsByName ? (audience?.noNameCount ?? 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="font-serif text-xl font-semibold text-neutral-900">{blastTitle(target)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {audience && (
            <div className="space-y-2 rounded-xl bg-neutral-50 px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => setRecipientsOpen((v) => !v)}
                disabled={audience.count === 0}
                className="flex w-full items-center gap-2 text-xs text-neutral-600 disabled:cursor-default"
              >
                <Users size={14} className="shrink-0 text-neutral-400" />
                {audience.count === 0 ? (
                  <span>
                    No one with a phone number on file matches this audience
                    {audience.optedOutCount > 0 && ` (${audience.optedOutCount} opted out)`}.
                  </span>
                ) : (
                  <>
                    <span className="flex-1 text-left">
                      Sending to <span className="font-semibold text-neutral-900">{effectiveCount}</span> {effectiveCount === 1 ? "person" : "people"}
                      {excludedIds.size > 0 && (
                        <span className="ml-1.5 font-medium text-neutral-500">
                          · {excludedIds.size} skipped
                        </span>
                      )}
                      {audience.optedOutCount > 0 && (
                        <span className="ml-1.5 font-medium text-neutral-500">
                          · {audience.optedOutCount} opted out
                        </span>
                      )}
                      {duplicateCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-amber-700">
                          <AlertTriangle size={11} /> {duplicateCount} possible {duplicateCount === 1 ? "duplicate" : "duplicates"}
                        </span>
                      )}
                      {noNameCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-amber-700">
                          <AlertTriangle size={11} /> {noNameCount} no name on file
                        </span>
                      )}
                    </span>
                    {recipientsOpen ? <ChevronUp size={14} className="shrink-0 text-neutral-400" /> : <ChevronDown size={14} className="shrink-0 text-neutral-400" />}
                  </>
                )}
              </button>
              {noNameCount > 0 && (
                <p className="text-[11px] text-amber-700">
                  Your message uses {"{{first_name}}"} - {noNameCount} {noNameCount === 1 ? "person" : "people"} below have no real name on file (just their
                  phone/email), so {noNameCount === 1 ? "they" : "they"} will be skipped rather than getting texted their own number as a greeting.
                </p>
              )}
              {recipientsOpen && audience.count > 0 && (
                <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1.5">
                  {audience.recipients.map((r) => {
                    const excluded = excludedIds.has(r.id);
                    return (
                      <div
                        key={r.id}
                        className={`rounded-md px-1.5 py-1.5 text-xs ${excluded ? "opacity-50" : r.duplicatePhone || r.duplicateName || (greetsByName && r.noRealName) ? "bg-amber-50" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1 truncate font-medium text-neutral-700">
                            {(r.duplicatePhone || r.duplicateName || (greetsByName && r.noRealName)) && <AlertTriangle size={11} className="shrink-0 text-amber-600" />}
                            <span className={`truncate ${excluded ? "line-through" : ""}`}>{r.name}</span>
                            {greetsByName && r.noRealName && <span className="shrink-0 text-[10px] text-amber-700">will be skipped</span>}
                          </span>
                          <span className="shrink-0 text-neutral-400">{r.phone}</span>
                          <button
                            type="button"
                            onClick={() => toggleExcluded(r.id)}
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${excluded ? "text-brand-600" : "text-neutral-400 hover:bg-neutral-100"}`}
                          >
                            {excluded ? (
                              <span className="flex items-center gap-1">
                                <Undo2 size={11} /> Include
                              </span>
                            ) : (
                              "Skip"
                            )}
                          </button>
                        </div>
                        {r.recentTexts.length > 0 && (
                          <div className="mt-1 space-y-0.5 border-l-2 border-neutral-100 pl-2">
                            {r.recentTexts.map((t, i) =>
                              t.kind === "text" ? (
                                <p key={i} className="text-[11px] leading-4 text-neutral-500">
                                  <span className={t.direction === "inbound" ? "font-medium text-neutral-700" : "text-neutral-500"}>
                                    {t.direction === "inbound" ? "Them" : "You"}:
                                  </span>{" "}
                                  &ldquo;{t.body}&rdquo; <span className="text-neutral-400">· {relativeTime(t.occurredAt)}</span>
                                </p>
                              ) : (
                                <p key={i} className="text-[11px] leading-4 text-neutral-500">
                                  {t.label ?? "Call"} <span className="text-neutral-400">· {relativeTime(t.occurredAt)}</span>
                                </p>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-neutral-400">
                Anyone already texted in the last hour is automatically left out. Scroll to read each person&apos;s recent texts (up to the last
                month) and tap Skip to leave out someone who already answered.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TEMPLATE_CATEGORIES.map((cat) => (
                <Button key={cat.key} variant="secondary" size="sm" onClick={() => setOpenTemplateCategory(cat.key)}>
                  {cat.label} templates
                </Button>
              ))}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hey {{first_name}}, quick reminder about tomorrow..."
              rows={4}
            />
            <p className="text-xs text-neutral-400">
              Use <code className="rounded bg-neutral-100 px-1 py-0.5">{"{{first_name}}"}</code> to personalize. Sent gradually over time rather
              than all at once - see below for an estimate.
            </p>
          </div>

          {preview && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Preview (sample name)</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{preview}</p>
            </div>
          )}

          <div className="space-y-2 border-t border-neutral-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Send yourself a test</p>
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Your phone number"
                className="flex-1"
              />
              <Button variant="secondary" onClick={sendTest} disabled={testSending || !message.trim() || !testPhone.trim()} className="shrink-0">
                <Send size={14} /> {testSending ? "Sending…" : "Test"}
              </Button>
            </div>
            {testResult && (
              <p className={testResult.ok ? "text-xs text-brand-700" : "text-xs text-red-600"}>
                {testResult.ok ? "Test sent - check your phone." : testResult.error}
              </p>
            )}
          </div>

          {result && (
            <p className={result.ok ? "text-sm text-brand-700" : "text-sm text-red-600"}>
              {result.ok
                ? `Queued for ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"} - should finish sending in roughly ${estimatedTextBlastMinutes(result.recipientCount)} minutes.`
                : result.error}
            </p>
          )}

          {confirming ? (
            <div className="space-y-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
              <p className="text-[15px] font-semibold text-neutral-900">Send to {effectiveCount} people?</p>
              <p className="text-sm leading-5 text-neutral-600">
                Sends from your Quo business number, staggered over about {estimatedTextBlastMinutes(effectiveCount)} minutes. You can cancel mid-send.
              </p>
              {inQuietHours && !sendNowOverride && (
                <p className="flex items-start gap-2 text-sm leading-5 text-amber-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    It&apos;s quiet hours right now - this will hold and start at <span className="font-semibold">{quietHoursEndLabel()}</span>.{" "}
                    <button type="button" onClick={() => setSendNowOverride(true)} className="font-semibold underline">
                      Send now anyway
                    </button>
                  </span>
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={send} disabled={sending} className="flex-1">
                  <Send size={15} /> {sending ? "Queuing…" : `Send to ${effectiveCount}`}
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={sending || !message.trim() || effectiveCount <= 0} className="w-full">
              <MessageSquareText size={15} /> {effectiveCount > 0 ? `Send staggered reminder to ${effectiveCount}` : "Send staggered reminder"}
            </Button>
          )}

          {history && history.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Previous sends to this audience</p>
              {history.map((b) => (
                <div key={b.id} className="rounded-xl border border-neutral-200 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-neutral-700">
                      {b.status === "sending" && `Sending: ${b.sent}/${b.total} sent`}
                      {b.status === "completed" && `Completed: ${b.sent}/${b.total} sent`}
                      {b.status === "canceled" && `Canceled: ${b.sent}/${b.total} sent`}
                    </span>
                    {b.status === "sending" && (
                      <button onClick={() => cancel(b.id)} className="font-medium text-red-600 hover:underline">
                        Cancel remaining
                      </button>
                    )}
                  </div>
                  {(b.failed > 0 || b.skipped > 0) && (
                    <p className="mt-1 text-neutral-400">
                      {b.failed > 0 && (
                        <button onClick={() => toggleFailures(b.id)} className="font-medium text-red-600 hover:underline">
                          {b.failed} failed
                        </button>
                      )}
                      {b.failed > 0 && b.skipped > 0 && " · "}
                      {b.skipped > 0 && `${b.skipped} skipped (no phone)`}
                    </p>
                  )}
                  {expandedFailures === b.id && (
                    <div className="mt-2 space-y-2 rounded-lg bg-red-50 p-2">
                      {!failureDetails[b.id] ? (
                        <p className="text-neutral-400">Loading…</p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {failureDetails[b.id].map((group) => (
                              <div key={group.error}>
                                <p className="font-medium text-red-700">
                                  {group.count}× — {group.error}
                                </p>
                                <p className="text-neutral-500">{group.sample.map((s) => s.name || s.phone).join(", ")}</p>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => retry(b.id)}
                            disabled={retrying === b.id}
                            className="font-medium text-red-700 hover:underline disabled:opacity-50"
                          >
                            {retrying === b.id ? "Retrying…" : "Retry failed sends"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <p className="mt-1 max-w-full truncate text-neutral-400">&ldquo;{b.message}&rdquo;</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {openTemplateCategory && (
        <TemplatePicker
          category={MESSAGE_TEMPLATE_CATEGORIES.find((c) => c.key === openTemplateCategory)!}
          account={null}
          eventName={null}
          onPick={setMessage}
          onClose={() => setOpenTemplateCategory(null)}
        />
      )}
    </div>
  );
}

function TemplatePicker({
  category,
  account,
  eventName,
  onPick,
  onClose,
}: {
  category: MessageTemplateCategory;
  account: string | null;
  eventName: string | null;
  onPick: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-serif text-lg font-semibold text-neutral-900">{category.label} templates</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {category.options.map((opt) => {
            const text = opt.build(account, eventName);
            return (
              <button
                key={opt.label}
                onClick={() => {
                  onPick(text);
                  onClose();
                }}
                className="block w-full rounded-xl border border-neutral-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="text-sm font-medium text-neutral-800">{opt.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-500">{text}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
