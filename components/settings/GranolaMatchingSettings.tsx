"use client";

import { useState } from "react";
import { updateGranolaMatchingRule } from "@/app/(app)/settings/granola-matching-actions";
import type { GranolaMatchingSettings as Settings } from "@/types/database";

const RULES: { key: "match_on_calendar_event" | "match_on_name_when_single" | "ask_when_ambiguous"; label: string }[] = [
  { key: "match_on_calendar_event", label: "Match automatically when a note carries a calendar event" },
  { key: "match_on_name_when_single", label: "Match automatically when exactly one contact's name is mentioned" },
  { key: "ask_when_ambiguous", label: "Suggest a match in the Notes inbox when two or more names fit" },
];

export function GranolaMatchingSettings({ settings }: { settings: Settings | null }) {
  const [values, setValues] = useState({
    match_on_calendar_event: settings?.match_on_calendar_event ?? true,
    match_on_name_when_single: settings?.match_on_name_when_single ?? true,
    ask_when_ambiguous: settings?.ask_when_ambiguous ?? true,
  });

  async function toggle(key: (typeof RULES)[number]["key"]) {
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    await updateGranolaMatchingRule(key, next);
  }

  return (
    <div>
      <p className="mb-2 text-sm text-neutral-500">How an unmatched note (no calendar invite, no attendee email) gets attached to a contact.</p>
      <div className="space-y-2">
        {RULES.map((rule) => (
          <label key={rule.key} className="flex items-center gap-2.5 text-sm text-neutral-700">
            <input type="checkbox" checked={values[rule.key]} onChange={() => toggle(rule.key)} className="h-4 w-4 rounded border-neutral-300" />
            {rule.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        A contact is never created without you choosing &ldquo;New contact from this note&rdquo; yourself - that one&apos;s not a toggle, it&apos;s always true.
      </p>
    </div>
  );
}
