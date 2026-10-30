"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronDown, MessageSquare, Phone } from "lucide-react";
import { ContactRow } from "@/components/contacts/ContactRow";
import { ContactsBulkBar } from "@/components/contacts/ContactsBulkBar";
import { useSectionOpen } from "@/lib/hooks/useSectionOpen";
import { groupContacts } from "@/lib/crm/contact-grouping";
import { hasUsablePhone } from "@/lib/crm/contact-filter-predicates";
import { campaignsTextHref } from "@/lib/crm/campaigns-handoff";
import { sourceChipLabel } from "@/lib/crm/contact-sources";
import { openQuoCall } from "@/lib/quo/call-link";
import { threadHref } from "@/lib/crm/inbox-href";
import { fullName, initials } from "@/lib/utils";
import type { ContactGroupBy } from "@/lib/crm/contact-filter-params";
import type { ContactSegment, ContactWithRelations, PipelineStage, Tag } from "@/types/database";

type SequenceOption = { id: string; name: string; type: "broadcast" | "drip" | "batch" };

export function ContactsList({
  contacts,
  tags,
  stages,
  ownerId,
  sequences: _sequences,
  segments = [],
  groupBy = "none",
  lastActivityLabels,
  selecting: selectingProp,
  onSelectingChange,
}: {
  contacts: ContactWithRelations[];
  tags: Tag[];
  stages: PipelineStage[];
  ownerId: string;
  sequences: SequenceOption[];
  segments?: ContactSegment[];
  groupBy?: ContactGroupBy;
  lastActivityLabels: Record<string, string>;
  selecting?: boolean;
  onSelectingChange?: (next: boolean) => void;
}) {
  const router = useRouter();
  const [internalSelecting, setInternalSelecting] = useState(false);
  const selecting = selectingProp ?? internalSelecting;
  const setSelecting = onSelectingChange ?? setInternalSelecting;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  const selectedIds = [...selected];
  const selectedContacts = contacts.filter((c) => selected.has(c.id));
  const groups = groupContacts(contacts, groupBy, stages);

  const tableMode = groupBy === "none";

  return (
    <div className={selecting && selected.size > 0 && !tableMode ? "pb-[calc(var(--app-bottom-nav)+4.5rem)] lg:pb-28" : undefined}>
      {selectingProp == null && (
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-0">
          <button onClick={() => (selecting ? exitSelection() : setSelecting(true))} className="text-sm font-semibold text-brand-600">
            {selecting ? "Cancel" : "Select"}
          </button>
          {selecting && (
            <button
              onClick={() => (selected.size === contacts.length ? setSelected(new Set()) : setSelected(new Set(contacts.map((c) => c.id))))}
              className="text-sm font-medium text-neutral-400 hover:text-neutral-600"
            >
              {selected.size === contacts.length ? "Deselect all" : `Select all ${contacts.length}`}
            </button>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <ContactsBulkBar
          selectedIds={selectedIds}
          selectedContacts={selectedContacts}
          tags={tags}
          stages={stages}
          segments={segments}
          ownerId={ownerId}
          onClear={exitSelection}
        />
      )}

      {contacts.length === 0 ? (
        <p className="px-4 py-10 text-center text-[15px] text-neutral-400">No contacts match. Try clearing filters or add a new contact.</p>
      ) : tableMode ? (
        <ContactsTable
          contacts={contacts}
          selected={selected}
          onToggle={toggle}
          lastActivityLabels={lastActivityLabels}
        />
      ) : (
        <div className="space-y-3 px-4 pb-6 sm:px-0">
          {groups.map((group) => (
            <ContactGroup
              key={group.key}
              groupKey={group.key}
              label={group.label}
              contacts={group.contacts}
              stages={stages}
              ownerId={ownerId}
              selecting={selecting}
              selected={selected}
              onToggle={toggle}
              lastActivityLabels={lastActivityLabels}
              onTextGroup={(ids) => {
                router.push(campaignsTextHref(ids));
              }}
            />
          ))}
        </div>
      )}

    </div>
  );
}

function ContactsTable({
  contacts,
  selected,
  onToggle,
  lastActivityLabels,
}: {
  contacts: ContactWithRelations[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  lastActivityLabels: Record<string, string>;
}) {
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#eadfd6] bg-white">
      <div className="grid grid-cols-[auto_minmax(0,2fr)_1fr_1fr_1fr_auto_auto] items-center gap-3 border-b border-[#eadfd6] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => {
            if (allSelected) contacts.forEach((c) => selected.has(c.id) && onToggle(c.id));
            else contacts.forEach((c) => !selected.has(c.id) && onToggle(c.id));
          }}
          aria-label="Select all"
          className="h-4 w-4 rounded border-neutral-300 accent-[#c45c4a]"
        />
        <span>Name</span>
        <span>Source</span>
        <span>Stage</span>
        <span>Last touch</span>
        <span className="text-center">Text</span>
        <span className="text-center">Call</span>
      </div>
      {contacts.map((contact) => {
        const source = sourceChipLabel(contact.lead_source);
        const stageName = contact.pipeline_stages?.name;
        return (
          <div
            key={contact.id}
            className="grid grid-cols-[auto_minmax(0,2fr)_1fr_1fr_1fr_auto_auto] items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
          >
            <input
              type="checkbox"
              checked={selected.has(contact.id)}
              onChange={() => onToggle(contact.id)}
              aria-label={`Select ${fullName(contact)}`}
              className="h-4 w-4 shrink-0 rounded border-neutral-300 accent-[#c45c4a]"
            />
            <Link href={`/contacts/${contact.id}`} data-contact-open={contact.id} className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3e4dc] text-[12px] font-semibold text-[#c45c4a]">
                {initials(contact.first_name, contact.last_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-neutral-900">{fullName(contact)}</span>
                {contact.phone && <span className="block truncate text-[12px] text-neutral-400">{contact.phone}</span>}
              </span>
            </Link>
            <div>
              {source ? (
                <span className="inline-flex rounded-full bg-[#f3e4dc] px-2.5 py-0.5 text-[12px] font-medium text-[#c45c4a]">{source}</span>
              ) : (
                <span className="text-[13px] text-neutral-300">—</span>
              )}
            </div>
            <div>
              {stageName ? (
                <span className="inline-flex rounded-full bg-[#f3e4dc] px-2.5 py-0.5 text-[12px] font-medium text-[#c45c4a]">{stageName}</span>
              ) : (
                <span className="text-[13px] text-neutral-300">—</span>
              )}
            </div>
            <span className="truncate text-[13px] text-neutral-500">{lastActivityLabels[contact.id] ?? "—"}</span>
            {hasUsablePhone(contact.phone) ? (
              <>
                <Link
                  href={threadHref(contact.id)}
                  aria-label={`Text ${fullName(contact)}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c45c4a] text-white"
                >
                  <MessageSquare size={14} />
                </Link>
                <button
                  type="button"
                  aria-label={`Call ${fullName(contact)}`}
                  onClick={() => openQuoCall(contact.phone!)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c45c4a] text-white"
                >
                  <Phone size={14} />
                </button>
              </>
            ) : (
              <>
                <span />
                <Link href={`/contacts/${contact.id}`} className="text-[12px] font-semibold text-neutral-400">
                  Open
                </Link>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContactGroup({
  groupKey,
  label,
  contacts,
  stages,
  ownerId,
  selecting,
  selected,
  onToggle,
  lastActivityLabels,
  onTextGroup,
}: {
  groupKey: string;
  label: string | null;
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  ownerId: string;
  selecting: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  lastActivityLabels: Record<string, string>;
  onTextGroup: (ids: string[]) => void;
}) {
  const [open, setOpen] = useSectionOpen(`contacts-group:${groupKey}`, true);
  // Blast IDs come only from this group's already-filtered rows. Registration
  // + phone gating happens in listContacts; Austin-style call-only Other cannot
  // appear here when that combo is on, so they cannot get a "Text the N" send.
  const withPhone = contacts.filter((c) => hasUsablePhone(c.phone));

  if (!label) {
    // Ungrouped ("none") - just the rows, one shared card with dividers
    // between them (DESIGN_SPEC.md §2/§6), no collapsible header.
    return (
      <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            stages={stages}
            ownerId={ownerId}
            selecting={selecting}
            selected={selected.has(c.id)}
            onToggle={() => onToggle(c.id)}
            lastActivityLabel={lastActivityLabels[c.id]}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <div className="flex w-full items-center gap-2.5 px-[18px] py-4 text-left">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          {open ? <ChevronDown size={17} className="text-neutral-400" /> : <ChevronRight size={17} className="text-neutral-400" />}
          <span className="text-base font-semibold text-neutral-900">{label}</span>
          <span className="text-[15px] text-neutral-400">{contacts.length}</span>
        </button>
        {withPhone.length > 0 && (
          <button
            type="button"
            onClick={() => onTextGroup(withPhone.map((c) => c.id))}
            className="ml-auto shrink-0 text-[15px] font-semibold text-brand-700"
          >
            Text the {withPhone.length} with numbers
          </button>
        )}
      </div>
      {open && <div className="divide-y divide-neutral-100 border-t border-neutral-100">
          {contacts.map((c) => (
            <ContactRow
              key={c.id}
              contact={c}
              stages={stages}
              ownerId={ownerId}
              selecting={selecting}
              selected={selected.has(c.id)}
              onToggle={() => onToggle(c.id)}
              lastActivityLabel={lastActivityLabels[c.id]}
            />
          ))}
        </div>}
    </div>
  );
}
