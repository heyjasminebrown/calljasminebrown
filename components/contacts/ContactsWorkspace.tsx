"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ContactFilters } from "@/components/contacts/ContactFilters";
import { ContactFiltersSheet } from "@/components/contacts/ContactFiltersSheet";
import { ContactsList } from "@/components/contacts/ContactsList";
import { ContactsListTabs } from "@/components/contacts/ContactsListTabs";
import { SmartListBuilder } from "@/components/contacts/SmartListBuilder";
import { SmartListsRail } from "@/components/contacts/SmartListsRail";
import { SmartListTextNext } from "@/components/contacts/SmartListTextNext";
import { isSmartList, SMART_LIST_VIEW } from "@/lib/crm/smart-lists";
import type { ContactGroupBy } from "@/lib/crm/contact-filter-params";
import type { ContactSegment, ContactWithRelations, PipelineStage, Tag } from "@/types/database";

type SequenceOption = { id: string; name: string; type: "broadcast" | "drip" | "batch" };

export function ContactsWorkspace({
  contacts,
  stages,
  tags,
  leadSources,
  eventNames,
  registeredEventNames,
  segments,
  sequences,
  ownerId,
  groupBy,
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
  groupBy: ContactGroupBy;
  lastActivityLabels: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const activeList = searchParams.get("list");
  const activeSegment = segments.find((seg) => seg.id === activeList);
  const smartView = searchParams.get("view") === SMART_LIST_VIEW || isSmartList(activeSegment);
  const [selecting, setSelecting] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(smartView);
  const [textNextOpen, setTextNextOpen] = useState(false);

  useEffect(() => {
    if (smartView) setFiltersOpen(true);
  }, [smartView]);

  const rightPanel = textNextOpen ? (
    <SmartListTextNext
      contacts={contacts}
      listName={activeSegment?.name ?? "Smart list follow-up"}
      onClose={() => setTextNextOpen(false)}
    />
  ) : filtersOpen ? (
    <aside className="sticky top-[88px] hidden h-[calc(100dvh-110px)] w-[280px] shrink-0 self-start overflow-hidden lg:block">
      <ContactFiltersSheet
        stages={stages}
        tags={tags}
        leadSources={leadSources}
        eventNames={eventNames}
        registeredEventNames={registeredEventNames}
        variant="panel"
        onClose={() => setFiltersOpen(false)}
      />
    </aside>
  ) : null;

  return (
    <div className="flex min-w-0 items-start gap-6">
      {smartView && <SmartListsRail segments={segments} />}
      <div className="flex min-w-0 flex-1 items-start gap-0">
        <div className="min-w-0 flex-1 space-y-4 pb-8">
          <ContactsListTabs segments={segments} ownerId={ownerId} />
          {smartView && (
            <SmartListBuilder
              contacts={contacts}
              stages={stages}
              tags={tags}
              segments={segments}
              ownerId={ownerId}
              onTextNext={() => {
                setTextNextOpen(true);
                setFiltersOpen(false);
              }}
            />
          )}
          <ContactFilters
            stages={stages}
            tags={tags}
            leadSources={leadSources}
            eventNames={eventNames}
            registeredEventNames={registeredEventNames}
            panel
            compact={smartView}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={(open) => {
              setFiltersOpen(open);
              if (open) setTextNextOpen(false);
            }}
            selectSlot={
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSelectOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-[11px] border border-neutral-200 bg-white px-3.5 py-3 text-[15px] font-medium text-neutral-800"
                >
                  Select <ChevronDown size={15} className="text-neutral-400" />
                </button>
                {selectOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setSelecting(true);
                        setSelectOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      Select rows
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelecting(false);
                        setSelectOpen(false);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            }
          />
          <ContactsList
            contacts={contacts}
            tags={tags}
            stages={stages}
            ownerId={ownerId}
            sequences={sequences}
            segments={segments}
            groupBy={groupBy}
            lastActivityLabels={lastActivityLabels}
            selecting={selecting}
            onSelectingChange={setSelecting}
          />
        </div>
        {rightPanel}
      </div>
    </div>
  );
}
