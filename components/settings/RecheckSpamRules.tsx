"use client";

import { useState } from "react";
import { recheckSpamRules } from "@/app/(app)/settings/spam-actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

export function RecheckSpamRules() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ checked: number; flaggedSpam: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const result = await recheckSpamRules();
    setRunning(false);
    if (result.ok) setStatus(result);
    else setError(result.error);
  }

  return (
    <BackfillRow
      description="Re-run the spam rules above against past calls that already have a transcript, so a new or updated rule catches what it should have the first time."
      running={running}
      onRun={run}
      result={
        error ? (
          <span className="text-[#ac3826]">{error}</span>
        ) : (
          status && <>Checked {status.checked}, moved {status.flaggedSpam} to spam.</>
        )
      }
    />
  );
}
