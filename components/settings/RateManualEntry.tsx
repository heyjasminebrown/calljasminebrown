"use client";

import { useState } from "react";
import { recordManualRate } from "@/app/(app)/settings/rate-actions";
import { Input, Button } from "@/components/ui";
import { formatLocal } from "@/lib/format-time";

export function RateManualEntry({ latestRatePct, latestRateDate }: { latestRatePct: number | null; latestRateDate: string | null }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const parsed = Number(value);
    if (!parsed) return;
    setSaving(true);
    const result = await recordManualRate(parsed);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setValue("");
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-neutral-900">Today&apos;s 30-year rate</p>
        <p className="mt-1.5 text-[15px] leading-[23px] text-neutral-600">
          {latestRatePct != null
            ? `${latestRatePct}% on file, as of ${formatLocal(latestRateDate!, "MMM d")}.`
            : "Nothing on file yet - the rate-move alert on Insights needs at least two entries to compare."}{" "}
          A FRED key pulls this automatically — otherwise type it in whenever it moves.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          step="0.01"
          placeholder="6.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-[88px] text-[16px] font-semibold"
        />
        <Button size="sm" onClick={handleSave} disabled={saving || !value}>
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
