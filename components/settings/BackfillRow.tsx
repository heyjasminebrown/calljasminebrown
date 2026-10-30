"use client";

// Shared row shape for every one-off backfill in Data repair - same kind
// of thing four times over (a one-line description, a Run button, a
// result line once it's gone) so the visual shape lives in one place
// instead of four near-identical stacked layouts.
export function BackfillRow({
  description,
  running,
  onRun,
  buttonLabel = "Run",
  result,
}: {
  description: string;
  running: boolean;
  onRun: () => void;
  buttonLabel?: string;
  result?: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-100 pb-3.5 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-3.5">
        <p className="min-w-0 flex-1 text-[15px] leading-[22px] text-neutral-600">{description}</p>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
        >
          {running ? "Running…" : buttonLabel}
        </button>
      </div>
      {result && <div className="mt-2 text-xs text-neutral-500">{result}</div>}
    </div>
  );
}
