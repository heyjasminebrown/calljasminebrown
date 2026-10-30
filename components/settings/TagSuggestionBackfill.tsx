"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runTagSuggestionBackfill } from "@/app/(app)/settings/tag-backfill-actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

// One-time: tag suggestions only started reading brand-new texts/calls
// going forward - this re-runs that same judgment against contacts'
// existing history, since nothing about it happens automatically for
// old activity. Processes a bounded batch per click (see
// lib/ai/backfill-classification.ts), so a large backlog needs a few
// clicks to fully work through - the result line says how many are left.
export function TagSuggestionBackfill() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ processed: number; suggested: number; remaining: number } | string | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await runTagSuggestionBackfill();
    setRunning(false);
    if (res.ok) {
      setResult({ processed: res.processed, suggested: res.suggested, remaining: res.remaining });
      router.refresh();
    } else {
      setResult(res.error);
    }
  }

  return (
    <BackfillRow
      description="Suggest tags (like Agent) from contacts' existing texts and calls, not just new ones. Shows up in Suggested for you to review."
      running={running}
      onRun={run}
      buttonLabel={typeof result === "object" && result?.remaining ? "Run next batch" : "Run"}
      result={
        result &&
        (typeof result === "string"
          ? result
          : result.processed === 0
            ? "Nothing left to check."
            : `Checked ${result.processed} contact${result.processed === 1 ? "" : "s"}, ${result.suggested} tag suggestion${result.suggested === 1 ? "" : "s"} added to Suggested.${result.remaining > 0 ? ` ${result.remaining} contacts left - run again to continue.` : ""}`)
      }
    />
  );
}
