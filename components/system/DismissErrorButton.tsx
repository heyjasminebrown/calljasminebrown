"use client";

import { useState, useTransition } from "react";
import { dismissSystemErrors } from "@/app/(app)/system-error-actions";

export function DismissErrorButton({ id, label }: { id?: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <span className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await dismissSystemErrors(id);
            setError(result.ok ? "" : result.error);
          })
        }
        className="text-xs font-semibold text-red-800 underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? "…" : label}
      </button>
      {error && <span className="block text-xs text-red-700">Couldn&apos;t dismiss: {error}</span>}
    </span>
  );
}
