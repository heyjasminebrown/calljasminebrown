"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Row of links under a Reports question's main chart - clicking one
// expands that report in place rather than navigating away, so all 26
// existing reports stay reachable without a page ever leaving "one thing
// worth doing." Content is pre-rendered server-side and just passed
// through as a prop; this component only owns which one is open.
export function QuestionExtras({ items }: { items: { key: string; label: string; content: React.ReactNode }[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setOpenKey((k) => (k === item.key ? null : item.key))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              openKey === item.key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {openKey && <div className="mt-4 border-t border-neutral-100 pt-4">{items.find((i) => i.key === openKey)?.content}</div>}
    </div>
  );
}
