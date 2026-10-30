"use client";

import { useState } from "react";

// Registered rows get two dismissals instead of one, because the existing
// one (dismissRegisteredNoFollowUp) isn't permanent - it only holds while
// it's newer than the registration that triggered it, so anyone she
// already texts outside Quo (her husband, a regular) comes right back the
// next time they register. "Never queue this person" is the permanent
// escape hatch, reviewable later from Settings -> People you know.
export function RegisteredRowMenu({
  label,
  busy,
  onNotThisTime,
  onNeverQueue,
}: {
  label: string;
  busy: boolean;
  onNotThisTime: () => void;
  onNeverQueue: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-500 disabled:opacity-50"
      >
        {label}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-full z-40 mt-1 w-[296px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNotThisTime();
              }}
              className="block w-full border-b border-neutral-100 px-3.5 py-3 text-left"
            >
              <span className="block text-[15px] font-semibold text-neutral-900">Not this time</span>
              <span className="mt-0.5 block text-[13px] text-neutral-500">Comes back if they register again</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNeverQueue();
              }}
              className="block w-full px-3.5 py-3 text-left"
            >
              <span className="block text-[15px] font-semibold text-neutral-900">Never queue this person</span>
              <span className="mt-0.5 block text-[13px] text-neutral-500">I know them personally — keep them out of every queue. Undo from their profile.</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
