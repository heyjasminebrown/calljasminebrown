"use client";

import { useState } from "react";
import { backfillQuoSync } from "@/app/(app)/contacts/actions";
import { BackfillRow } from "@/components/settings/BackfillRow";

export function QuoSyncBackfill() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ synced: number; failed: number; remaining: number } | null>(null);

  async function run() {
    setRunning(true);
    const result = await backfillQuoSync();
    setRunning(false);
    if (result.ok) setStatus({ synced: result.synced, failed: result.failed, remaining: result.remaining });
  }

  return (
    <BackfillRow
      description="Push every contact with a phone number into Quo, so calls show a name."
      running={running}
      onRun={run}
      result={
        status && (
          <>
            Synced {status.synced}
            {status.failed > 0 && `, ${status.failed} failed`}.{" "}
            {status.remaining > 0 ? `${status.remaining} left — click again to continue.` : "All caught up."}
          </>
        )
      }
    />
  );
}
