"use client";

import { useState } from "react";
import { runAutoStageNow } from "@/app/(app)/contacts/actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

type Result = { ok: true; moved: number } | { ok: false; error: string };

export function AutoStageRunNow() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    try {
      const outcome = await runAutoStageNow();
      setResult(outcome);
    } catch {
      setResult({ ok: false, error: "That failed - try again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <BackfillRow
      description="Move New Lead -> Contacted -> Nurturing contacts up to date right now, instead of waiting for the hourly check."
      running={running}
      onRun={run}
      result={
        result &&
        (result.ok ? <p>{result.moved === 0 ? "Nothing to move - already up to date." : `${result.moved} contact${result.moved === 1 ? "" : "s"} moved.`}</p> : <p className="text-red-600">{result.error}</p>)
      }
    />
  );
}
