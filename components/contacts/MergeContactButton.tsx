"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Merge } from "lucide-react";
import { MergeContactModal } from "@/components/contacts/MergeContactModal";
import type { MergeCandidate } from "@/lib/data/contacts";

export function MergeContactButton({
  contactId,
  contactName,
  candidates,
}: {
  contactId: string;
  contactName: string;
  candidates: MergeCandidate[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Merge size={15} /> Merge
      </Button>
      {open && (
        <MergeContactModal contactId={contactId} contactName={contactName} candidates={candidates} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
