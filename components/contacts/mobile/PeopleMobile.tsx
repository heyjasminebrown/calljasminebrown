"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { PeopleList } from "@/components/contacts/mobile/PeopleList";
import { ContactFiltersSheet } from "@/components/contacts/ContactFiltersSheet";
import { ContactsListTabs } from "@/components/contacts/ContactsListTabs";
import { SmartListBuilder } from "@/components/contacts/SmartListBuilder";
import { isSmartList, SMART_LIST_VIEW } from "@/lib/crm/smart-lists";
import { ActiveFilterTags } from "@/components/contacts/ActiveFilterTags";
import { ContactsBulkBar } from "@/components/contacts/ContactsBulkBar";
import { CountScopeNote } from "@/components/CountScopeNote";
import { SHEET_PARAM_KEYS } from "@/lib/crm/contact-filter-params";
import { cn } from "@/lib/utils";
import type { ContactGroupBy } from "@/lib/crm/contact-filter-params";
import type { ContactWithRelations, PipelineStage, Tag, ContactSegment } from "@/types/database";

type SequenceOption = { id: string; name: string; type: string };
const GROUP_VALUES: ContactGroupBy[] = ["none", "stage", "tag", "source", "month"];

function matchesQuery(contact: ContactWithRelations, q: string) {
  const hay = `${contact.first_name} ${contact.last_name} ${contact.email ?? ""} ${contact.phone ?? ""}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export function PeopleMobile({
  contacts,
  stages,
  tags,
  leadSources,
  eventNames,
  registeredEventNames,
  segments,
  sequences: _sequences,
  ownerId,
  lastActivityLabels,
}: {
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  tags: Tag[];
  leadSources: string[];
  eventNames: string[];
  registeredEventNames: string[];
  segments: ContactSegment[];
  sequences: SequenceOption[];
  ownerId: string;
  lastActivityLabels: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlGroup = searchParams.get("group");
  const groupBy: ContactGroupBy = GROUP_VALUES.includes(urlGroup as ContactGroupBy) ? (urlGroup as ContactGroupBy) : "none";

  const activeFilterCount = SHEET_PARAM_KEYS.filter((k) => {
    const raw = searchParams.get(k);
    if (!raw) return false;
    if (k === "group" && raw === "none") return false;
    if (k === "archived" && raw === "active") return false;
    return true;
  }).length;

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `/contacts?${qs}` : "/contacts");
  }

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams((params) => {
        if (value.trim()) params.set("q", value.trim());
        else params.delete("q");
      });
    }, 300);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeList = searchParams.get("list");
  const smartView = searchParams.get("view") === SMART_LIST_VIEW || isSmartList(segments.find((seg) => seg.id === activeList));
  const searched = search.trim() ? contacts.filter((c) => matchesQuery(c, search)) : contacts;
  const selectedIds = [...selected];
  const selectedContacts = searched.filter((c) => selected.has(c.id));

  if (selecting) {
    return (
      <div className="px-4 py-4 lg:hidden">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
            className="text-[16px] font-semibold text-[#c45c4a]"
          >
            Cancel
          </button>
          <p className="text-[16px] font-semibold text-[#c45c4a]">{selected.size} selected</p>
        </div>
        <div className="mb-4">
          <ContactsBulkBar
            selectedIds={selectedIds}
            selectedContacts={selectedContacts}
            tags={tags}
            stages={stages}
            segments={segments}
            ownerId={ownerId}
            variant="mobile"
            onClear={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
          />
        </div>
        <PeopleList
          contacts={searched}
          stages={stages}
          ownerId={ownerId}
          groupBy={groupBy}
          lastActivityLabels={lastActivityLabels}
          selecting
          selected={selected}
          onToggle={toggle}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-5 lg:hidden">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[28px] font-semibold tracking-[-0.02em] text-neutral-900">Contacts</p>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {contacts.length} people · leads from Zillow, referrals, events, and more
          </p>
          <CountScopeNote current="contacts" />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/contacts/new" aria-label="New contact" className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white">
            <Plus size={20} />
          </Link>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, email, phone"
          className="h-[50px] w-full rounded-[14px] border border-neutral-200 bg-white pl-10 pr-3.5 text-[16px] text-neutral-900"
        />
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className={cn(
          "mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-[15px] font-semibold",
          activeFilterCount > 0 ? "bg-[#c45c4a] text-white" : "border border-neutral-200 bg-white text-neutral-800",
        )}
      >
        <SlidersHorizontal size={16} />
        Filters
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[12px]">{activeFilterCount}</span>
        )}
      </button>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ActiveFilterTags stages={stages} tags={tags} />
      </div>

      {smartView && (
        <div className="mb-3">
          <SmartListBuilder
            contacts={searched}
            stages={stages}
            tags={tags}
            segments={segments}
            ownerId={ownerId}
            variant="mobile"
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ContactsListTabs segments={segments} ownerId={ownerId} variant="picker" />
        </div>
        <button
          type="button"
          onClick={() => {
            if (selecting) {
              setSelecting(false);
              setSelected(new Set());
            } else setSelecting(true);
          }}
          className="shrink-0 text-[14px] font-semibold text-[#c45c4a]"
        >
          {selecting ? "Cancel" : "Select"}
        </button>
      </div>

      <PeopleList
        contacts={searched}
        stages={stages}
        ownerId={ownerId}
        groupBy={groupBy}
        lastActivityLabels={lastActivityLabels}
        selecting={false}
        selected={selected}
        onToggle={toggle}
      />

      {filtersOpen && (
        <ContactFiltersSheet
          stages={stages}
          tags={tags}
          leadSources={leadSources}
          eventNames={eventNames}
          registeredEventNames={registeredEventNames}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}
