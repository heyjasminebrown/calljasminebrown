"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { TextBlastModal } from "@/components/contacts/TextBlastModal";
import { parseCampaignAudienceIds } from "@/lib/crm/campaigns-handoff";
import type { BlastTarget } from "@/app/(app)/contacts/text-blast-actions";
import type { Tag } from "@/types/database";

// The picker step TextTabClient used to own on its own route - folded
// onto the unified Campaigns list instead, since a text send now shows up
// in the same place as an email one.
export function NewTextButton({
  tags,
  preloadedIds,
  autoOpenIds,
}: {
  tags: Tag[];
  preloadedIds?: string | null;
  // Bulk "Message all" handoff: same ?ids= pattern as Contacts bulk text.
  autoOpenIds?: string | null;
}) {
  const router = useRouter();
  const preloaded = parseCampaignAudienceIds(preloadedIds ?? autoOpenIds);
  const [open, setOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState(tags[0]?.id ?? "");
  const [composeTarget, setComposeTarget] = useState<BlastTarget | null>(() => {
    if (preloaded.length) {
      return {
        kind: "contacts",
        contactIds: preloaded,
        label: `${preloaded.length} selected contact${preloaded.length === 1 ? "" : "s"}`,
      };
    }
    return null;
  });
  const tagById = new Map(tags.map((t) => [t.id, t]));

  function compose() {
    const tag = tagById.get(selectedTagId);
    if (!tag) return;
    setComposeTarget({ kind: "tag", tagId: tag.id, tagName: tag.name });
    setOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-800"
      >
        <MessageSquareText size={14} /> New text
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-full z-40 mt-1 w-80 space-y-3 rounded-xl border border-neutral-200 bg-white p-3.5 shadow-lg">
            {tags.length === 0 ? (
              <p className="text-xs text-neutral-400">No tags yet - add one in Settings or on a contact first.</p>
            ) : (
              <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm"
              >
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={compose} className="h-9 w-full rounded-lg bg-neutral-900 text-sm font-semibold text-white">
              Compose
            </button>
          </div>
        </>
      )}

      {composeTarget && (
        <TextBlastModal
          target={composeTarget}
          onClose={() => {
            setComposeTarget(null);
            if (preloaded.length) router.replace("/sequences");
          }}
        />
      )}
    </div>
  );
}
