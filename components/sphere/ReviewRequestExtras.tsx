"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReviewRequestExtras({
  onSnooze,
  onDismiss,
}: {
  onSnooze: () => Promise<{ ok: boolean }>;
  onDismiss: () => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    await fn();
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handle(onSnooze)}
        disabled={busy}
        className="rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
      >
        Ask again in a week
      </button>
      <button
        type="button"
        onClick={() => handle(onDismiss)}
        disabled={busy}
        className="rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-500 disabled:opacity-50"
      >
        Not this one
      </button>
    </>
  );
}
