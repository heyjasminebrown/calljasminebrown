"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type WorklistMenuItem = {
  label: string;
  description?: string;
  onClick: () => void;
};

export function WorklistRowMenu({
  busy,
  items,
  ariaLabel = "More actions",
}: {
  busy?: boolean;
  items: WorklistMenuItem[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-400 disabled:opacity-50"
      >
        <MoreHorizontal size={20} />
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-[280px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            {items.map((item, i) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`block w-full px-3.5 py-3 text-left ${i < items.length - 1 ? "border-b border-neutral-100" : ""}`}
              >
                <span className="block text-[15px] font-semibold text-neutral-900">{item.label}</span>
                {item.description && <span className="mt-0.5 block text-[13px] text-neutral-500">{item.description}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
