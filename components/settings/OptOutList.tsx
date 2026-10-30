"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { clearOptOut } from "@/app/(app)/contacts/consent-actions";
import { relativeTime } from "@/lib/format-time";

export type OptedOutContact = { id: string; name: string; optedOutAt: string };

// Opt-outs were only ever visible one at a time, per-contact (ConsentStatus
// on their profile) or as an ephemeral count inside a blast's audience
// preview - there was nowhere to just see who has opted out, or clear a
// stale one, without already knowing the contact. clearOptOut is the same
// action ConsentStatus uses on the contact page, so this list can never
// drift from what a single contact's page shows.
export function OptOutList({ contacts }: { contacts: OptedOutContact[] }) {
  const router = useRouter();
  const [clearing, setClearing] = useState<string | null>(null);

  async function handleClear(contactId: string) {
    setClearing(contactId);
    await clearOptOut(contactId);
    setClearing(null);
    router.refresh();
  }

  return (
    <Section sectionKey="settings:opt-outs" title="Opted out" meta={`${contacts.length}`} defaultOpen={false}>
      <div className="divide-y divide-neutral-100 px-[18px] py-2">
        {contacts.length === 0 ? (
          <p className="py-3 text-[14px] text-neutral-400">Nobody has opted out.</p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link href={`/contacts/${c.id}`} className="truncate text-[15px] font-medium text-neutral-800 hover:underline">
                  {c.name}
                </Link>
                <p className="text-[13px] text-neutral-400">Opted out {relativeTime(c.optedOutAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleClear(c.id)}
                disabled={clearing === c.id}
                className="shrink-0 text-[13px] font-semibold text-brand-600 underline disabled:opacity-50"
              >
                {clearing === c.id ? "Clearing…" : "Clear"}
              </button>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}
