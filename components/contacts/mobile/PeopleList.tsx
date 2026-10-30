"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, StickyNote, Clock, PhoneOff, Check } from "lucide-react";
import { ListRow } from "@/components/mobile/ListRow";
import { SwipeActions } from "@/components/mobile/SwipeActions";
import { StickyGroupHeader } from "@/components/mobile/StickyGroupHeader";
import { LogSheet } from "@/components/contacts/mobile/LogSheet";
import { snoozeFollowUp } from "@/app/(app)/today-actions";
import { groupContacts } from "@/lib/crm/contact-grouping";
import { useToast } from "@/lib/hooks/useToast";
import { Toast } from "@/components/mobile/Toast";
import { CONTACT_TYPE_LABELS, cn, formatPhone, fullName } from "@/lib/utils";
import { sourceChipLabel } from "@/lib/crm/contact-sources";
import type { ContactGroupBy } from "@/lib/crm/contact-filter-params";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

// Mirrors desktop ContactRow's meta line (type · phone · last activity) and
// its "No phone number · email only" fallback - the mobile list used to
// show only lead_source, dropping both signals on the screen she scans
// most.
function rowMeta(contact: ContactWithRelations, lastActivityLabel: string | undefined) {
  const source = sourceChipLabel(contact.lead_source);
  if (!contact.phone) {
    return (
      <span className="flex items-center gap-1.5">
        {source && <span className="rounded-full bg-[#f3e4dc] px-2 py-0.5 text-[11px] font-medium text-[#c45c4a]">{source}</span>}
        <PhoneOff size={14} className="shrink-0 text-neutral-400" /> No phone number · email only
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {source && <span className="shrink-0 rounded-full bg-[#f3e4dc] px-2 py-0.5 text-[11px] font-medium text-[#c45c4a]">{source}</span>}
      <span className="truncate">{[CONTACT_TYPE_LABELS[contact.contact_type], formatPhone(contact.phone), lastActivityLabel].filter(Boolean).join(" · ")}</span>
    </span>
  );
}

function SelectRow({
  contact,
  checked,
  onToggle,
}: {
  contact: ContactWithRelations;
  checked: boolean;
  onToggle: () => void;
}) {
  const source = sourceChipLabel(contact.lead_source);
  const phone = contact.phone ? formatPhone(contact.phone) : null;
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-start gap-3.5 px-4 py-4 text-left">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-[#c45c4a] bg-[#c45c4a] text-white" : "border-[#c45c4a] bg-white",
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold leading-[22px] text-neutral-900">{fullName(contact)}</span>
        {source && (
          <span className="mt-1 inline-flex rounded-full bg-[#f3e4dc] px-2 py-0.5 text-[11px] font-medium text-[#c45c4a]">{source}</span>
        )}
        {phone && <span className="mt-1 block text-[14px] leading-[20px] text-neutral-400">{phone}</span>}
      </span>
    </button>
  );
}

export function PeopleList({
  contacts,
  stages,
  ownerId,
  groupBy = "none",
  lastActivityLabels,
  selecting = false,
  selected,
  onToggle,
}: {
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  ownerId: string;
  groupBy?: ContactGroupBy;
  lastActivityLabels: Record<string, string>;
  selecting?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [logContact, setLogContact] = useState<{ id: string; name: string } | null>(null);

  const groups = groupContacts(contacts, groupBy, stages);
  const collapsible = groupBy !== "none";

  async function snooze(contactId: string) {
    const res = await snoozeFollowUp(contactId);
    if (!res.ok) showToast("Couldn't snooze that", "error");
    else router.refresh();
  }

  if (selecting) {
    return (
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-[16px] bg-white">
        {contacts.length === 0 ? (
          <p className="px-4 py-10 text-center text-[15px] text-neutral-400">No contacts match. Try clearing filters or add a new contact.</p>
        ) : (
          contacts.map((contact) => (
            <SelectRow
              key={contact.id}
              contact={contact}
              checked={selected?.has(contact.id) ?? false}
              onToggle={() => onToggle?.(contact.id)}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-[#ebe9e7] bg-white">
      {contacts.length === 0 ? (
        <p className="px-4 py-10 text-center text-[15px] text-neutral-400">No contacts match. Try clearing filters or add a new contact.</p>
      ) : (
        groups.map((group) => (
        <StickyGroupHeader
          key={group.key}
          label={group.label || "All"}
          count={group.contacts.length}
          collapsible={collapsible}
          sectionKey={`people:${groupBy}:${group.key}`}
          defaultOpen
        >
          <div className="divide-y divide-neutral-100">
            {group.contacts.map((contact) => {
              const name = `${contact.first_name} ${contact.last_name}`.trim();
              const actions = [
                ...(contact.phone
                  ? [{ icon: MessageSquareText, label: "Text", bg: "#e7e5e4", onClick: () => router.push(`/messages/${contact.id}`) }]
                  : []),
                { icon: StickyNote, label: "Log", bg: "#292524", onClick: () => setLogContact({ id: contact.id, name }) },
                { icon: Clock, label: "Snooze", bg: "#ac3826", onClick: () => snooze(contact.id) },
              ];
              const href = `/contacts/${contact.id}`;
              return (
                <SwipeActions key={contact.id} rowId={contact.id} openRowId={openRowId} onOpenChange={setOpenRowId} actions={actions}>
                  <ListRow
                    href={href}
                    avatar={{ firstName: contact.first_name, lastName: contact.last_name }}
                    name={name}
                    secondaryText={rowMeta(contact, lastActivityLabels[contact.id])}
                  />
                </SwipeActions>
              );
            })}
            {group.contacts.length === 0 && <p className="px-4 py-4 text-center text-sm text-neutral-400">Nobody here.</p>}
          </div>
        </StickyGroupHeader>
        ))
      )}
      {logContact && <LogSheet open onClose={() => setLogContact(null)} ownerId={ownerId} contactId={logContact.id} contactName={logContact.name} />}
      <Toast toast={toast} />
    </div>
  );
}
