"use client";

import { useState } from "react";
import { backfillGranolaNotes } from "@/app/(app)/contacts/actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

type Result = Awaited<ReturnType<typeof backfillGranolaNotes>>;

export function GranolaSyncBackfill() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    const outcome = await backfillGranolaNotes();
    setRunning(false);
    setResult(outcome);
  }

  return (
    <BackfillRow
      description="Pull the last 90 days of Granola notes, in case a webhook was missed or a note wasn't ready yet."
      running={running}
      onRun={run}
      result={
        result &&
        (result.ok ? (
          <p>
            {result.notes} note{result.notes === 1 ? "" : "s"} found · {result.processed} synced
            {result.notReady > 0 ? ` · ${result.notReady} not ready yet` : ""}
            {result.failed > 0 ? ` · ${result.failed} failed` : ""}
          </p>
        ) : (
          <p className="text-red-600">{result.error}</p>
        ))
      }
    />
  );
}
