"use client";

import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";
import { QuickAddMenu } from "./QuickAddMenu";

export function QuickAddButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Hidden on message threads - the compose bar already occupies that
  // corner of the screen and the two would visually overlap.
  if (pathname.startsWith("/messages/")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick add"
        className="fixed bottom-[calc(var(--app-bottom-nav)+16px)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus size={26} />
      </button>
      {open && <QuickAddMenu onClose={() => setOpen(false)} />}
    </>
  );
}
