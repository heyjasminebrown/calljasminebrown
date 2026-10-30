"use client";

import { useState } from "react";
import { backfillBlinq } from "@/app/(app)/contacts/actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

type Result = Awaited<ReturnType<typeof backfillBlinq>>;

export function BlinqShareBackfill() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    try {
      const outcome = await backfillBlinq();
      setResult(outcome);
    } catch {
      setResult({ ok: false, error: "That timed out or failed - try running it again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <BackfillRow
      description="Search Gmail for Blinq share notifications from before this was set up, and pull those contacts in now. Processes up to 40 at a time, oldest first - if there's more, just run it again."
      running={running}
      onRun={run}
      result={
        result &&
        (result.ok ? (
          <p>
            {result.found} share{result.found === 1 ? "" : "s"} found · {result.added} contact{result.added === 1 ? "" : "s"} processed
            {result.capped && " · more than 40 found, run again to keep going"}
          </p>
        ) : (
          <p className="text-red-600">{result.error}</p>
        ))
      }
    />
  );
}
