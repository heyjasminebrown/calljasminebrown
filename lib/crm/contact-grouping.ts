import type { ContactWithRelations, PipelineStage } from "@/types/database";
import type { ContactGroupBy } from "@/lib/crm/contact-filter-params";

export type ContactGroup = { key: string; label: string; contacts: ContactWithRelations[] };

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// Cohort-by-month is the one grouping where every contact belongs to
// exactly one bucket unambiguously (lead_date is a single value) - stage/
// tag/source are the same in spirit, just off different single-value
// fields, except tag (a contact can have several) which uses its
// alphabetically-first tag so nobody appears in two sections at once and
// silently breaks "select all" counts in the bulk-action bar.
export function groupContacts(contacts: ContactWithRelations[], groupBy: ContactGroupBy, stages: PipelineStage[]): ContactGroup[] {
  if (groupBy === "none") return [{ key: "all", label: "", contacts }];

  const buckets = new Map<string, ContactGroup>();

  function push(key: string, label: string, contact: ContactWithRelations) {
    const existing = buckets.get(key);
    if (existing) existing.contacts.push(contact);
    else buckets.set(key, { key, label, contacts: [contact] });
  }

  for (const c of contacts) {
    if (groupBy === "stage") {
      const stage = stages.find((s) => s.id === c.stage_id);
      push(stage?.id ?? "none", stage?.name ?? "No stage", c);
    } else if (groupBy === "tag") {
      // ct.tags can come back null - a contact_tags row can pass its own
      // RLS (scoped through the parent contact) while the embedded tags
      // row fails its own RLS independently (e.g. a tag created by an
      // admin-client webhook path) - PostgREST returns null rather than
      // dropping the row, so this can never be treated as always-present.
      const withTag = c.contact_tags.filter((ct) => ct.tags);
      const firstTag = [...withTag].sort((a, b) => a.tags!.name.localeCompare(b.tags!.name))[0];
      push(firstTag?.tags!.id ?? "none", firstTag?.tags!.name ?? "No tag", c);
    } else if (groupBy === "source") {
      push(c.lead_source ?? "none", c.lead_source ?? "No source", c);
    } else if (groupBy === "month") {
      const d = new Date(c.lead_date);
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      push(key, MONTH_LABEL.format(d), c);
    }
  }

  const groups = [...buckets.values()];

  if (groupBy === "stage") {
    groups.sort((a, b) => {
      const idxA = stages.findIndex((s) => s.id === a.key);
      const idxB = stages.findIndex((s) => s.id === b.key);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  } else if (groupBy === "month") {
    groups.sort((a, b) => (a.key < b.key ? 1 : -1)); // newest cohort first
  } else {
    groups.sort((a, b) => a.label.localeCompare(b.label));
  }

  return groups;
}
