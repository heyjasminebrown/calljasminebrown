"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearPinnedItem, fixDoubleRegistration, markKnownPersonally, dismissWeeklyReviewItem } from "@/app/(app)/today-actions";
import { mergeContacts } from "@/app/(app)/contacts/actions";
import type { WeeklyReviewPayload } from "@/lib/data/weekly-review";

export function WeeklyReviewCard({ id, payload }: { id: string; payload: WeeklyReviewPayload }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());

  async function handleClear() {
    setClearing(true);
    await clearPinnedItem(id);
    router.refresh();
  }

  function hide(rowKey: string) {
    setHiddenRows((prev) => new Set(prev).add(rowKey));
    setRowErrors((prev) => {
      const next = new Map(prev);
      next.delete(rowKey);
      return next;
    });
  }

  function showError(rowKey: string, error: string) {
    setRowErrors((prev) => new Map(prev).set(rowKey, error));
  }

  // The card's payload is a stale snapshot (see filterResolvedWeeklyReviewItems),
  // so hide() alone only removed a row for the rest of this page's
  // lifetime - it came right back on the next visit even when the fix
  // genuinely worked, because nothing here checked whether it actually
  // did. Every handler below now checks the result and only hides on a
  // real success; "Leave it"/"Compare later" persist an explicit
  // dismissal instead of silently doing nothing, for the same reason.
  async function handleFix(rowKey: string, secondActivityId: string) {
    setBusyRow(rowKey);
    const result = await fixDoubleRegistration(secondActivityId);
    setBusyRow(null);
    if (!result.ok) {
      showError(rowKey, result.error);
      return;
    }
    hide(rowKey);
    router.refresh();
  }

  async function handleLeaveDouble(rowKey: string, contactId: string) {
    setBusyRow(rowKey);
    const result = await dismissWeeklyReviewItem("weekly_review_double", contactId);
    setBusyRow(null);
    if (!result.ok) {
      showError(rowKey, result.error);
      return;
    }
    hide(rowKey);
  }

  async function handleMerge(rowKey: string, keepId: string, mergeId: string) {
    setBusyRow(rowKey);
    const result = await mergeContacts(keepId, mergeId);
    setBusyRow(null);
    if (!result.ok) {
      showError(rowKey, result.error);
      return;
    }
    hide(rowKey);
    router.refresh();
  }

  async function handleCompareLater(rowKey: string, contactId: string) {
    setBusyRow(rowKey);
    const result = await dismissWeeklyReviewItem("weekly_review_dup", contactId);
    setBusyRow(null);
    if (!result.ok) {
      showError(rowKey, result.error);
      return;
    }
    hide(rowKey);
  }

  async function handleKnowThem(rowKey: string, contactId: string) {
    setBusyRow(rowKey);
    const result = await markKnownPersonally(contactId);
    setBusyRow(null);
    if (!result.ok) {
      showError(rowKey, result.error);
      return;
    }
    hide(rowKey);
    router.refresh();
  }

  const checksVisible =
    payload.doubleRegistrations.some((d) => !hiddenRows.has(`double:${d.contactId}`)) ||
    payload.duplicatePhonePairs.some((p) => !hiddenRows.has(`dup:${p.aId}:${p.bId}`)) ||
    payload.noPhoneRegistrantsCount > 0 ||
    payload.possiblyKnownPersonally.some((k) => !hiddenRows.has(`known:${k.contactId}`));

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <div className="flex items-center gap-2.5 border-b border-neutral-100 px-[18px] py-4">
        <p className="text-base font-semibold text-neutral-900">Your weekly review</p>
        <button type="button" onClick={handleClear} disabled={clearing} className="ml-auto shrink-0 text-sm font-medium text-neutral-500 disabled:opacity-50">
          {clearing ? "Clearing…" : "Clear"}
        </button>
      </div>

      <div className="p-[18px]">
        <p className="text-[15px] leading-6 text-neutral-700">{payload.whatHappened.summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[15px] text-neutral-700">
          {payload.whatHappened.stats.map((s) => (
            <span key={s.label}>
              <span className="font-semibold text-neutral-900">{s.value}</span> {s.label}{" "}
              <span className="text-sm text-neutral-400">({s.previous} last week)</span>
            </span>
          ))}
          <span>
            <span className="font-semibold text-neutral-900">{payload.whatHappened.underContractNow}</span> under contract now
          </span>
        </div>

        {payload.mondaysCalls.length > 0 && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-neutral-500">Monday&apos;s calls</p>
            <ol className="mt-1.5 space-y-1">
              {payload.mondaysCalls.map((c, i) => (
                <li key={c.contactId} className="text-[15px] text-neutral-700">
                  <span className="text-neutral-400">{i + 1}.</span>{" "}
                  <Link href={`/contacts/${c.contactId}`} className="font-semibold text-neutral-900">
                    {c.name}
                  </Link>{" "}
                  — {c.reason}
                </li>
              ))}
            </ol>
            <Link href="/dialer" className="mt-2 inline-block text-sm font-semibold text-brand-700">
              Send all {payload.mondaysCalls.length} to Event calls
            </Link>
          </div>
        )}

        {checksVisible && (
          <div className="mt-5">
            <p className="text-sm font-semibold text-neutral-500">Worth double-checking</p>
            <div className="mt-1.5 space-y-2.5">
              {payload.doubleRegistrations.map((d) => {
                const rowKey = `double:${d.contactId}`;
                if (hiddenRows.has(rowKey)) return null;
                const error = rowErrors.get(rowKey);
                return (
                  <div key={rowKey} className="text-[15px] text-neutral-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        Double registration within seconds for <span className="font-semibold">{d.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFix(rowKey, d.secondActivityId)}
                        disabled={busyRow === rowKey}
                        className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                      >
                        Fix to New
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLeaveDouble(rowKey, d.contactId)}
                        disabled={busyRow === rowKey}
                        className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-500 disabled:opacity-50"
                      >
                        Leave it
                      </button>
                    </div>
                    {error && <p className="mt-1 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
                  </div>
                );
              })}

              {payload.duplicatePhonePairs.map((p) => {
                const rowKey = `dup:${p.aId}:${p.bId}`;
                if (hiddenRows.has(rowKey)) return null;
                const error = rowErrors.get(rowKey);
                return (
                  <div key={rowKey} className="text-[15px] text-neutral-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        Duplicate records sharing a phone: <span className="font-semibold">{p.aName}</span> and <span className="font-semibold">{p.bName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMerge(rowKey, p.aId, p.bId)}
                        disabled={busyRow === rowKey}
                        className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                      >
                        Merge into {p.aName}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCompareLater(rowKey, p.bId)}
                        disabled={busyRow === rowKey}
                        className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-500 disabled:opacity-50"
                      >
                        Compare later
                      </button>
                    </div>
                    {error && <p className="mt-1 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
                  </div>
                );
              })}

              {payload.noPhoneRegistrantsCount > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-[15px] text-neutral-700">
                  <span className="min-w-0 flex-1">{payload.noPhoneRegistrantsCount} registrants this week with no phone number</span>
                  <Link href="/contacts?phone=0" className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800">
                    See them
                  </Link>
                </div>
              )}

              {payload.possiblyKnownPersonally.map((k) => {
                const rowKey = `known:${k.contactId}`;
                if (hiddenRows.has(rowKey)) return null;
                const error = rowErrors.get(rowKey);
                return (
                  <div key={rowKey} className="text-[15px] text-neutral-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{k.name}</span> shares a {k.matchedOn} with <span className="font-semibold">{k.matchedName}</span>, already in
                        your sphere
                      </span>
                      <button
                        type="button"
                        onClick={() => handleKnowThem(rowKey, k.contactId)}
                        disabled={busyRow === rowKey}
                        className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                      >
                        Review
                      </button>
                    </div>
                    {error && <p className="mt-1 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-neutral-400">These checks run whether or not you ever turn automation on.</p>
          </div>
        )}
      </div>
    </div>
  );
}
