"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { toggleSpamRule, removeSpamAllowlistEntry } from "@/app/(app)/settings/spam-actions";
import { ALL_SPAM_RULE_REASONS } from "@/lib/crm/spam-signals";
import { formatPhone } from "@/lib/utils";
import { relativeTime } from "@/lib/format-time";
import { RecheckSpamRules } from "@/components/settings/RecheckSpamRules";

export type AllowlistedNumber = { id: string; phone: string; createdAt: string };

export function SpamFiltersCard({
  disabledReasons,
  allowlist,
}: {
  disabledReasons: string[];
  allowlist: AllowlistedNumber[];
}) {
  const router = useRouter();
  const [disabled, setDisabled] = useState(new Set(disabledReasons));
  const [removing, setRemoving] = useState<string | null>(null);

  async function toggle(reason: string) {
    const enabled = disabled.has(reason);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(reason);
      else next.add(reason);
      return next;
    });
    await toggleSpamRule(reason, enabled);
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    await removeSpamAllowlistEntry(id);
    setRemoving(null);
    router.refresh();
  }

  return (
    <Section sectionKey="settings:spam-filters" title="Spam filters" meta={`${ALL_SPAM_RULE_REASONS.length - disabled.size} on`} defaultOpen={false}>
      <div className="px-[18px] py-4">
        <p className="text-[15px] leading-[23px] text-neutral-600">
          Calls and texts matching an enabled rule below skip your inbox entirely and land in the Spam bucket instead.
        </p>
        <div className="mt-3.5 space-y-3.5">
          {ALL_SPAM_RULE_REASONS.map((reason) => {
            const on = !disabled.has(reason);
            return (
              <div key={reason} className="flex items-center gap-3.5">
                <p className={`min-w-0 flex-1 text-[16px] leading-6 ${on ? "text-neutral-700" : "text-neutral-500"}`}>{reason}</p>
                <button
                  type="button"
                  onClick={() => toggle(reason)}
                  className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800"
                >
                  {on ? "On" : "Off"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-neutral-100 px-[18px] py-4">
        <RecheckSpamRules />
      </div>

      <div className="border-t border-neutral-100 px-[18px] py-2">
        <p className="pt-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-neutral-500">Allowlisted numbers</p>
        <div className="divide-y divide-neutral-100">
          {allowlist.length === 0 ? (
            <p className="py-3 text-[14px] text-neutral-400">Nothing allowlisted yet. Tap &quot;Not spam&quot; on a call to add it here.</p>
          ) : (
            allowlist.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-neutral-800">{formatPhone(entry.phone)}</p>
                  <p className="text-[13px] text-neutral-400">Added {relativeTime(entry.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                  disabled={removing === entry.id}
                  className="shrink-0 text-[13px] font-semibold text-brand-600 underline disabled:opacity-50"
                >
                  {removing === entry.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Section>
  );
}
