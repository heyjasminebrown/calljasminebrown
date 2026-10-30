import Link from "next/link";
import { Suspense } from "react";
import { X, Download, Plus } from "lucide-react";
import {
  listContacts,
  listStages,
  listTags,
  listLeadSources,
  listLastEventNames,
  listRegisteredEventNames,
  listSegments,
  getLastActivityLabels,
} from "@/lib/data/contacts";
import { listSequencesWithSummary } from "@/lib/data/sequences";
import { parseContactFilterParams } from "@/lib/crm/contact-filter-params";
import { isSmartList, SMART_LIST_VIEW } from "@/lib/crm/smart-lists";
import { ContactsWorkspace } from "@/components/contacts/ContactsWorkspace";
import { BulkImportContactsButton } from "@/components/contacts/BulkImportContactsButton";
import { PeopleMobile } from "@/components/contacts/mobile/PeopleMobile";
import { CountScopeNote } from "@/components/CountScopeNote";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const rawParams = await searchParams;
  // One URLSearchParams built up front, then handed to the same parser the
  // export route uses - the page and the export can never drift apart on
  // what a given filter param means, and it doubles as the export link's
  // query string (export always matches exactly what's on screen).
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (value) usp.set(key, value);
  }
  const filters = parseContactFilterParams(usp);
  // Table is the default (Name · Source · Stage · Last touch). Grouping
  // stays available from the Filters panel.
  const groupBy = filters.groupBy ?? "none";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [contacts, stages, tags, leadSources, eventNames, registeredEventNames, sequences, segments] = await Promise.all([
    listContacts(filters),
    listStages(),
    listTags(),
    listLeadSources(),
    listLastEventNames(),
    listRegisteredEventNames(),
    listSequencesWithSummary(),
    listSegments(),
  ]);
  const lastActivityLabels = await getLastActivityLabels(contacts.map((c) => c.id));
  const activeSegment = segments.find((seg) => seg.id === usp.get("list"));
  const smartView = usp.get("view") === SMART_LIST_VIEW || isSmartList(activeSegment);

  return (
    <>
      <Suspense fallback={<div className="px-4 py-8 text-[15px] text-neutral-400 lg:hidden">Loading contacts…</div>}>
        <PeopleMobile
          contacts={contacts}
          stages={stages}
          tags={tags}
          leadSources={leadSources}
          eventNames={eventNames}
          registeredEventNames={registeredEventNames}
          segments={segments}
          sequences={sequences.map((s) => ({ id: s.id, name: s.name, type: s.type }))}
          ownerId={user?.id ?? ""}
          lastActivityLabels={Object.fromEntries(lastActivityLabels)}
        />
      </Suspense>
      {/* Desktop list uses the full main column at lg+, not a phone-width
          max-w-3xl. Mobile PeopleMobile is lg:hidden so the two never stack. */}
      <div className="mx-auto hidden w-full max-w-[1400px] px-8 lg:block">
      <div className="sticky top-0 z-10 bg-[#f7f1ea] pt-8 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className={
                smartView
                  ? "font-serif text-[32px] font-semibold leading-9 tracking-[-0.03em] text-[#c45c4a]"
                  : "font-display text-[32px] font-semibold leading-9 tracking-[-0.03em] text-neutral-900"
              }
            >
              {smartView ? (activeSegment?.name ?? "Smart List Builder") : "Contacts"}
            </h1>
            <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-600">
              {smartView
                ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"} match these rules`
                : `${contacts.length} people · leads from Zillow, referrals, events, and more`}
            </p>
            <CountScopeNote current="contacts" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/api/contacts/export?${usp.toString()}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <Download size={14} /> Export
            </a>
            {user && <BulkImportContactsButton tags={tags} ownerId={user.id} />}
            <Link
              href="/contacts/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={15} /> New contact
            </Link>
          </div>
        </div>
        {filters.leadDateWithinDays && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            <span>
              Showing new leads from the last {filters.leadDateWithinDays} day{filters.leadDateWithinDays === 1 ? "" : "s"}
            </span>
            <Link href="/contacts" className="flex shrink-0 items-center gap-1 font-medium hover:underline">
              <X size={13} /> Clear
            </Link>
          </div>
        )}
      </div>
        <ContactsWorkspace
          contacts={contacts}
          stages={stages}
          tags={tags}
          leadSources={leadSources}
          eventNames={eventNames}
          registeredEventNames={registeredEventNames}
          segments={segments}
          sequences={sequences.map((s) => ({ id: s.id, name: s.name, type: s.type }))}
          ownerId={user?.id ?? ""}
          groupBy={groupBy}
          lastActivityLabels={Object.fromEntries(lastActivityLabels)}
        />
      </div>
    </>
  );
}
