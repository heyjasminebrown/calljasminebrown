"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { SquarePen } from "lucide-react";
import { NewMessageModal } from "@/components/messages/NewMessageModal";
import type { TextableContact } from "@/lib/data/messages";

export function NewMessageButton({ contacts }: { contacts: TextableContact[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <SquarePen size={14} /> New message
      </Button>
      {open && <NewMessageModal contacts={contacts} onClose={() => setOpen(false)} />}
    </>
  );
}
