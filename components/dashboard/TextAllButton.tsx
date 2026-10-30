"use client";

import { useState } from "react";
import { TextBlastModal } from "@/components/contacts/TextBlastModal";

// "Text all N" on the Registered-no-follow-up group header - reuses the
// same {kind:"contacts", contactIds, label} target ContactsList's bulk bar
// already sends TextBlastModal, just triggered from the group header
// instead of a multi-select.
export function TextAllButton({ contactIds, label }: { contactIds: string[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (contactIds.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 text-[15px] font-medium text-brand-700"
      >
        Text all {contactIds.length}
      </button>
      {open && <TextBlastModal target={{ kind: "contacts", contactIds, label }} onClose={() => setOpen(false)} />}
    </>
  );
}
