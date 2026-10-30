"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { unmarkKnownPersonally } from "@/app/(app)/today-actions";

export type KnownPersonallyContact = { id: string; name: string };

// "Never queue this person" (Today's Registered chip) is permanent and
// silent by design - this card is what makes it reviewable instead of
// invisible, per the owner's own footnote copy on that menu.
export function KnownPersonallyList({ contacts }: { contacts: KnownPersonallyContact[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(contactId: string) {
    setRemoving(contactId);
    await unmarkKnownPersonally(contactId);
    setRemoving(null);
    router.refresh();
  }

  return (
    <Section sectionKey="settings:known-personally" title="People you know" meta={`${contacts.length}`} defaultOpen={false}>
      <div className="divide-y divide-neutral-100 px-[18px] py-2">
        {contacts.length === 0 ? (
          <p className="py-3 text-[14px] text-neutral-400">Nobody kept out of every queue yet.</p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/contacts/${c.id}`} className="min-w-0 truncate text-[15px] font-medium text-neutral-800 hover:underline">
                {c.name}
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                disabled={removing === c.id}
                className="shrink-0 text-[13px] font-semibold text-brand-600 underline disabled:opacity-50"
              >
                {removing === c.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))
        )}
      </div>
    </Section>
  );
}
