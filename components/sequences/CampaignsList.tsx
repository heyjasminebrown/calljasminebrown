"use client";

import { useState } from "react";
import { EmailCampaignRow, TextCampaignRow } from "@/components/sequences/CampaignRow";
import { cn } from "@/lib/utils";
import type { SequenceListItem } from "@/lib/data/sequences";
import type { TextBlastWithProgress } from "@/app/(app)/contacts/text-blast-actions";
import type { Tag } from "@/types/database";

type Row = { kind: "email"; createdAt: string; seq: SequenceListItem } | { kind: "text"; createdAt: string; blast: TextBlastWithProgress };
type Filter = "all" | "email" | "text" | "scheduled";

// Texts and emails used to live on two different routes - a send in
// flight on one was invisible from the other. One list now, newest
// first, with filter chips instead of a tab that hides half the picture.
export function CampaignsList({ sequences, blasts, tags }: { sequences: SequenceListItem[]; blasts: TextBlastWithProgress[]; tags: Tag[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const tagById = new Map(tags.map((t) => [t.id, t]));

  const rows: Row[] = [
    ...sequences.map((seq) => ({ kind: "email" as const, createdAt: seq.created_at, seq })),
    ...blasts.map((blast) => ({ kind: "text" as const, createdAt: blast.created_at, blast })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "email") return r.kind === "email";
    if (filter === "text") return r.kind === "text";
    return r.kind === "email" ? r.seq.type !== "drip" && !!r.seq.nextSendAt : r.blast.status === "sending";
  });

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "email", label: "Email" },
    { key: "text", label: "Text" },
    { key: "scheduled", label: "Scheduled" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-neutral-200">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium",
              filter === chip.key ? "border-brand-600 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-700",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-neutral-500">Nothing here yet.</p>}
        {filtered.map((r) =>
          r.kind === "email" ? (
            <EmailCampaignRow key={`e-${r.seq.id}`} seq={r.seq} tagById={tagById} />
          ) : (
            <TextCampaignRow key={`t-${r.blast.id}`} blast={r.blast} tagById={tagById} />
          ),
        )}
      </div>
    </div>
  );
}
