"use client";

import { useState } from "react";
import { TextBlastModal } from "@/components/contacts/TextBlastModal";
import type { DialerContact } from "@/lib/data/dialer";

// Reuses TextBlastModal's existing "contacts" target kind (already
// supports an explicit ID list, from the People redesign's Inside-a-list
// compose card) rather than building a second bulk-send path just for
// this queue. Same dashed-box shape at both sizes - only the parent's
// column width (340px on desktop, full width on mobile) differs.
export function BulkSendCard({ contacts, label }: { contacts: DialerContact[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (contacts.length === 0) return null;

  return (
    <div className="rounded-[16px] border border-dashed border-neutral-300 p-3.5">
      <p className="text-[14px] leading-5 text-neutral-600">Send the welcome text to all {contacts.length} at once</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 h-10 rounded-full border border-neutral-200 px-3.5 text-[13px] font-semibold text-neutral-700">
        Compose
      </button>
      {open && <TextBlastModal target={{ kind: "contacts", contactIds: contacts.map((c) => c.id), label }} onClose={() => setOpen(false)} />}
    </div>
  );
}
