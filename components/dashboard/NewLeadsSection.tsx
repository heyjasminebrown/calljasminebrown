"use client";

import { useState } from "react";
import { NewLeadCard } from "@/components/dashboard/NewLeadCard";
import type { NewLeadContact } from "@/lib/data/new-leads";
import type { TextTemplate } from "@/types/database";

// Thin queue/advance wrapper, same local-queue shape as
// components/dialer/DialerWorkspace.tsx, but deliberately not reusing that
// component: no tabs, Add-someone, or bulk-send fit an embedded Today
// section the way they fit a dedicated Dialer page.
export function NewLeadsSection({
  contacts,
  layout,
  defaultDraftTemplate,
}: {
  contacts: NewLeadContact[];
  layout: "mobile" | "desktop";
  defaultDraftTemplate: TextTemplate | null;
}) {
  const [queue, setQueue] = useState(contacts);
  const current = queue[0];

  function advance() {
    setQueue((q) => q.slice(1));
  }

  // Today is a triage feed, not a dedicated page - once the queue is
  // empty, this section should just disappear rather than permanently
  // occupying space with an empty-state card the way the Dialer does.
  if (!current) return null;

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="font-serif text-lg font-semibold text-neutral-900">New leads</p>
        <p className="text-[13px] text-neutral-500">{queue.length} to reach out to</p>
      </div>
      <NewLeadCard key={current.id} contact={current} layout={layout} defaultDraftTemplate={defaultDraftTemplate} onAdvance={advance} />
    </div>
  );
}
