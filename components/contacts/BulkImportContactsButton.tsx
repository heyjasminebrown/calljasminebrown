"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Upload } from "lucide-react";
import { BulkImportContactsModal } from "@/components/contacts/BulkImportContactsModal";
import type { Tag } from "@/types/database";

export function BulkImportContactsButton({ tags, ownerId }: { tags: Tag[]; ownerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} /> Import
      </Button>
      {open && <BulkImportContactsModal tags={tags} ownerId={ownerId} onClose={() => setOpen(false)} />}
    </>
  );
}
