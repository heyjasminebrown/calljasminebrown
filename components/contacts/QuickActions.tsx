"use client";

import { useState } from "react";
import { Phone, MessageSquare, Mail, Video, CalendarClock, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import { openQuoCall, openQuoText } from "@/lib/quo/call-link";
import { ScheduleMeetingModal } from "@/components/contacts/ScheduleMeetingModal";
import { SchedulingLinkModal } from "@/components/contacts/SchedulingLinkModal";
import { InstagramMessageModal } from "@/components/contacts/InstagramMessageModal";

const actionClass =
  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-600";

function ActionLink({
  href,
  icon: Icon,
  label,
  disabled,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
  disabled?: boolean;
}) {
  return (
    <a
      href={disabled ? undefined : href}
      aria-disabled={disabled}
      className={cn(actionClass, disabled ? "pointer-events-none opacity-40" : "active:bg-neutral-50")}
    >
      <Icon size={19} />
      {label}
    </a>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  onClick: () => void;
  icon: typeof Phone;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(actionClass, disabled ? "opacity-40" : "active:bg-neutral-50")}
    >
      <Icon size={19} />
      {label}
    </button>
  );
}

export function QuickActions({
  contactId,
  contactName,
  phone,
  email,
  instagramSenderId,
}: {
  contactId: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  instagramSenderId?: string | null;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [sendingSchedulingLink, setSendingSchedulingLink] = useState(false);
  const [messagingInstagram, setMessagingInstagram] = useState(false);
  const firstName = contactName.split(" ")[0] ?? "";

  return (
    <div className="flex gap-2">
      <ActionButton onClick={() => phone && openQuoCall(phone)} icon={Phone} label="Call" disabled={!phone} />
      <ActionButton onClick={() => phone && openQuoText(phone)} icon={MessageSquare} label="Text" disabled={!phone} />
      <ActionLink href={`mailto:${email}`} icon={Mail} label="Email" disabled={!email} />
      <ActionButton onClick={() => setScheduling(true)} icon={Video} label="Meet" disabled={!email} />
      <ActionButton onClick={() => setSendingSchedulingLink(true)} icon={CalendarClock} label="Book" disabled={!phone} />
      {instagramSenderId && <ActionButton onClick={() => setMessagingInstagram(true)} icon={Instagram} label="Instagram" />}
      {scheduling && (
        <ScheduleMeetingModal contactId={contactId} contactName={contactName} email={email ?? null} onClose={() => setScheduling(false)} />
      )}
      {sendingSchedulingLink && (
        <SchedulingLinkModal contactId={contactId} firstName={firstName} phone={phone ?? null} onClose={() => setSendingSchedulingLink(false)} />
      )}
      {messagingInstagram && instagramSenderId && (
        <InstagramMessageModal igSenderId={instagramSenderId} contactName={firstName} onClose={() => setMessagingInstagram(false)} />
      )}
    </div>
  );
}
