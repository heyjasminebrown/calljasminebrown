"use client";

import { Phone } from "lucide-react";
import { openQuoCall } from "@/lib/quo/call-link";
import { cn } from "@/lib/utils";

export function CallButton({ phone, className }: { phone: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => openQuoCall(phone)}
      aria-label="Call"
      className={cn("rounded-full p-2 text-neutral-500 hover:bg-neutral-100", className)}
    >
      <Phone size={18} />
    </button>
  );
}
