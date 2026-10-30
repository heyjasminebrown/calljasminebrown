"use client";

import { useState } from "react";
import { backfillMissedVoicemails } from "@/app/(app)/settings/spam-actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

export function MissedVoicemailBackfill() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ checked: number; recovered: number; flaggedSpam: number; stillMissing: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    const result = await backfillMissedVoicemails();
    setRunning(false);
    if (result.ok) setStatus(result);
    else setError(result.error);
  }

  return (
    <BackfillRow
      description="Re-pull recordings/transcripts Quo had for missed calls before we knew to read them, and re-check those calls for spam."
      running={running}
      onRun={run}
      result={
        error ? (
          <span className="text-[#ac3826]">{error}</span>
        ) : (
          status && (
            <>
              Checked {status.checked}, recovered {status.recovered}
              {status.flaggedSpam > 0 && `, flagged ${status.flaggedSpam} as spam`}.{" "}
              {status.stillMissing > 0 ? `${status.stillMissing} still have nothing in Quo — click again later.` : "All caught up."}
            </>
          )
        )
      }
    />
  );
}
