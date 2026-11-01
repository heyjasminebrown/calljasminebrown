"use client";

import { useState } from "react";
import { Phone, MessageSquare, Mail, StickyNote, ListTodo, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { openQuoCall } from "@/lib/quo/call-link";
import { messageComposeHref } from "@/lib/crm/new-lead-text-templates";
import { cn } from "@/lib/utils";
import { EmailComposeModal } from "@/components/contacts/EmailComposeModal";

const itemClass =
  "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-brand-700 disabled:opacity-40";

export function EngageStrip({
  contactId,
  phone,
  email,
  contactName,
  smsDraft,
  onNote,
  onTask,
  onStage,
  sticky = true,
}: {
  contactId: string;
  phone?: string | null;
  email?: string | null;
  contactName: string;
  smsDraft?: string;
  onNote: () => void;
  onTask: () => void;
  onStage: () => void;
  sticky?: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);

  return (
    <div className={cn("rounded-[16px] border border-[#f2e1d6] bg-[#fbf3ec]", sticky && "sticky top-0 z-20")}>
      <p className="pt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">Engage</p>
      <div className="grid grid-cols-6 px-1 pb-1">
        <button type="button" onClick={() => phone && openQuoCall(phone)} disabled={!phone} className={itemClass}>
          <Phone size={18} strokeWidth={1.8} />
          Call
        </button>
        <button
          type="button"
          onClick={() => phone && router.push(messageComposeHref(contactId, smsDraft))}
          disabled={!phone}
          className={itemClass}
        >
          <MessageSquare size={18} strokeWidth={1.8} />
          Text
        </button>
        <button type="button" onClick={() => setComposing(true)} disabled={!email} className={itemClass}>
          <Mail size={18} strokeWidth={1.8} />
          Email
        </button>
        <button type="button" onClick={onNote} className={itemClass}>
          <StickyNote size={18} strokeWidth={1.8} />
          Note
        </button>
        <button type="button" onClick={onTask} className={itemClass}>
          <ListTodo size={18} strokeWidth={1.8} />
          Task
        </button>
        <button type="button" onClick={onStage} className={itemClass}>
          <Flag size={18} strokeWidth={1.8} />
          Stage
        </button>
      </div>
      {composing && email && (
        <EmailComposeModal contactId={contactId} email={email} contactName={contactName} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}
