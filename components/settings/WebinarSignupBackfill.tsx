"use client";

import { useState } from "react";
import { backfillWebinar } from "@/app/(app)/contacts/actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

type Result = Awaited<ReturnType<typeof backfillWebinar>>;

export function WebinarSignupBackfill() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    try {
      setResult(await backfillWebinar());
    } catch {
      setResult({ ok: false, error: "That timed out or failed - try running it again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <BackfillRow
      description="Import webinar sign-ups from Gmail: adds everyone from your “Webinar sign-up:” emails (heyjasminebrown.com/conference) as Community / Warm, Source Conference. Anyone whose email is already in the CRM is skipped, so it's safe to run again."
      buttonLabel="Import"
      running={running}
      onRun={run}
      result={
        result &&
        (result.ok ? (
          <p>
            {result.found} sign-up email{result.found === 1 ? "" : "s"} found · {result.added} new contact{result.added === 1 ? "" : "s"} added · {result.alreadyInCrm} already in
            your CRM
            {result.unreadable > 0 && ` · ${result.unreadable} couldn't be read`}
            {result.failed > 0 && ` · ${result.failed} failed (run again)`}
            {result.capped && " · more than 60 found, run again to keep going"}
          </p>
        ) : (
          <p className="text-red-600">{result.error}</p>
        ))
      }
    />
  );
}
