"use client";

import { useState } from "react";
import { updateWarmNotificationRule } from "@/app/(app)/settings/warm-notification-actions";
import type { WarmNotificationSettings as Settings } from "@/types/database";

const RULES: { key: "rule_triple_open" | "rule_past_client_click" | "rule_hot_twice" | "rule_every_open"; label: string }[] = [
  { key: "rule_triple_open", label: "Three opens of the same email in a day" },
  { key: "rule_past_client_click", label: "A past client clicking after six quiet months" },
  { key: "rule_hot_twice", label: "Anyone Hot / Ready opening twice in a week" },
  { key: "rule_every_open", label: "Every single open" },
];

export function WarmNotificationSettings({ settings }: { settings: Settings | null }) {
  const [values, setValues] = useState({
    rule_triple_open: settings?.rule_triple_open ?? true,
    rule_past_client_click: settings?.rule_past_client_click ?? true,
    rule_hot_twice: settings?.rule_hot_twice ?? true,
    rule_every_open: settings?.rule_every_open ?? false,
  });

  async function toggle(key: (typeof RULES)[number]["key"]) {
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    await updateWarmNotificationRule(key, next);
  }

  return (
    <div>
      <p className="text-[15px] leading-[23px] text-neutral-600">
        Pushed when someone&apos;s reading your emails without replying. Nothing fires outside 9am–9pm.
      </p>
      <div className="mt-3.5 space-y-3.5">
        {RULES.map((rule) => (
          <div key={rule.key} className="flex items-center gap-3.5">
            <p className={`min-w-0 flex-1 text-[16px] leading-6 ${values[rule.key] ? "text-neutral-700" : "text-neutral-500"}`}>{rule.label}</p>
            <button
              type="button"
              onClick={() => toggle(rule.key)}
              className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800"
            >
              {values[rule.key] ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
