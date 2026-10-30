"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runBacklogCleanup } from "@/app/(app)/settings/cleanup-actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

// One-time: Replies owed and Suggested only started filtering out
// closing/low-signal messages going forward - this re-runs that same
// judgment against whatever was already sitting there before, since
// nothing about it happens automatically for old rows.
export function BacklogCleanup() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ repliesCleared: number; insightsCleared: number } | string | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await runBacklogCleanup();
    setRunning(false);
    if (res.ok) {
      setResult({ repliesCleared: res.repliesCleared, insightsCleared: res.insightsCleared });
      router.refresh();
    } else {
      setResult(res.error);
    }
  }

  return (
    <BackfillRow
      description="Re-check the Replies owed and Suggested backlog against the current filters. Safe to run more than once."
      running={running}
      onRun={run}
      result={
        result &&
        (typeof result === "string"
          ? result
          : `Cleared ${result.repliesCleared} repl${result.repliesCleared === 1 ? "y" : "ies"} owed, dismissed ${result.insightsCleared} suggested card${result.insightsCleared === 1 ? "" : "s"}.`)
      }
    />
  );
}
