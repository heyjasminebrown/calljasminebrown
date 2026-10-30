import { applyMergeFields } from "@/lib/crm/merge-fields";
import { parseIncludeIds } from "@/lib/crm/contact-filter-params";
import { hasUsablePhone } from "@/lib/crm/contact-filter-predicates";
import type { TextAndNextLead } from "@/lib/crm/today-v1";
function contactDisplayName(contact: { first_name: string; last_name?: string | null }) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

export const SMART_LIST_VIEW = "smart";
export const SMART_LIST_KIND = "smart";

export const SMART_LIST_META_KEYS = new Set(["list", "view", "select", "kind", "q"]);

export const SMART_LIST_FOLLOWUP_TEMPLATE =
  "Hey {{first_name}} — just checking in. Anything I can help with?";

export type SmartListRuleField = "stage" | "tag_or_list" | "last_touch";

export type SmartListRule = {
  id: string;
  field: SmartListRuleField;
  value: string;
};

export type SmartListSegment = {
  id: string;
  name: string;
  filters: unknown;
};

export function segmentFilterRecord(filters: unknown): Record<string, string> {
  if (!filters || typeof filters !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function isSmartListFilters(filters: unknown): boolean {
  const record = segmentFilterRecord(filters);
  return record.kind === SMART_LIST_KIND || record.view === SMART_LIST_VIEW;
}

export function isSmartList(segment: SmartListSegment | null | undefined): boolean {
  return !!segment && isSmartListFilters(segment.filters);
}

export function partitionLists<T extends SmartListSegment>(segments: T[]): { staticLists: T[]; smartLists: T[] } {
  const staticLists: T[] = [];
  const smartLists: T[] = [];
  for (const segment of segments) {
    if (isSmartList(segment)) smartLists.push(segment);
    else staticLists.push(segment);
  }
  return { staticLists, smartLists };
}

export function encodeTagOrListValue(kind: "tag" | "list", id: string): string {
  return `${kind}:${id}`;
}

export function parseTagOrListValue(raw: string): { kind: "tag" | "list"; id: string } | null {
  const match = /^(tag|list):(.+)$/.exec(raw.trim());
  if (!match) return null;
  return { kind: match[1] as "tag" | "list", id: match[2] };
}

export function parseLastTouchDays(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  return Math.floor(days);
}

export function parseInListIds(raw: string | null | undefined): string[] {
  return parseIncludeIds(raw);
}

export function lastTouchIsOlderThan(lastTouchAt: string | null | undefined, days: number, now = new Date()): boolean {
  if (days <= 0) return false;
  if (!lastTouchAt) return true;
  const touched = new Date(lastTouchAt).getTime();
  if (Number.isNaN(touched)) return true;
  return now.getTime() - touched >= days * 86_400_000;
}

export function membershipIdsFromFilters(filters: unknown): string[] {
  return [...new Set(parseIncludeIds(segmentFilterRecord(filters).ids))];
}

export function requiredIdsForLists(segments: SmartListSegment[], listIds: string[]): string[] | null {
  if (listIds.length === 0) return null;
  const allowed = new Set<string>();
  for (const id of listIds) {
    const segment = segments.find((item) => item.id === id);
    if (!segment) continue;
    for (const memberId of membershipIdsFromFilters(segment.filters)) allowed.add(memberId);
  }
  return [...allowed];
}

export function defaultSmartListRules(): SmartListRule[] {
  return [
    { id: "rule-stage", field: "stage", value: "" },
    { id: "rule-tag", field: "tag_or_list", value: "" },
    { id: "rule-last-touch", field: "last_touch", value: "" },
  ];
}

export function rulesFromSearchParams(sp: URLSearchParams): SmartListRule[] {
  const rules: SmartListRule[] = [{ id: "rule-stage", field: "stage", value: sp.get("stage") ?? "" }];

  const tagIds = (sp.get("tags") ?? "").split(",").filter(Boolean);
  const listIds = (sp.get("inList") ?? "").split(",").filter(Boolean);
  if (tagIds.length === 0 && listIds.length === 0) {
    rules.push({ id: "rule-tag", field: "tag_or_list", value: "" });
  } else {
    tagIds.forEach((id, index) => {
      rules.push({ id: `rule-tag-${index}`, field: "tag_or_list", value: encodeTagOrListValue("tag", id) });
    });
    listIds.forEach((id, index) => {
      rules.push({ id: `rule-list-${index}`, field: "tag_or_list", value: encodeTagOrListValue("list", id) });
    });
  }

  rules.push({ id: "rule-last-touch", field: "last_touch", value: sp.get("lastTouch") ?? "" });
  return rules;
}

export function applyRulesToSearchParams(sp: URLSearchParams, rules: SmartListRule[]): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  next.set("view", SMART_LIST_VIEW);

  const stages = rules.filter((rule) => rule.field === "stage" && rule.value.trim()).map((rule) => rule.value.trim());
  const tagIds: string[] = [];
  const listIds: string[] = [];
  let lastTouch = "";

  for (const rule of rules) {
    if (rule.field === "tag_or_list") {
      const parsed = parseTagOrListValue(rule.value);
      if (parsed?.kind === "tag") tagIds.push(parsed.id);
      if (parsed?.kind === "list") listIds.push(parsed.id);
    }
    if (rule.field === "last_touch") {
      const days = parseLastTouchDays(rule.value);
      if (days) lastTouch = String(days);
    }
  }

  if (stages.length) next.set("stage", stages.join(","));
  else next.delete("stage");

  if (tagIds.length) next.set("tags", [...new Set(tagIds)].join(","));
  else next.delete("tags");

  if (listIds.length) next.set("inList", [...new Set(listIds)].join(","));
  else next.delete("inList");

  if (lastTouch) next.set("lastTouch", lastTouch);
  else next.delete("lastTouch");

  return next;
}

export function smartListFiltersToStore(sp: URLSearchParams): Record<string, string> {
  const filters = Object.fromEntries([...sp.entries()].filter(([key]) => !SMART_LIST_META_KEYS.has(key)));
  filters.kind = SMART_LIST_KIND;
  return filters;
}

export function smartListSearchParamsFromFilters(filters: unknown): URLSearchParams {
  const record = segmentFilterRecord(filters);
  const params = new URLSearchParams();
  params.set("view", SMART_LIST_VIEW);
  for (const [key, value] of Object.entries(record)) {
    if (SMART_LIST_META_KEYS.has(key) || !value) continue;
    params.set(key, value);
  }
  return params;
}

export function contactsMatchSmartRules<T extends { id: string; stage_id: string | null; contact_tags: { tags: { id: string } | null }[] }>(
  contacts: T[],
  rules: SmartListRule[],
  lastTouchById: Map<string, string>,
  listMembersById: Map<string, string[]>,
  now = new Date(),
): T[] {
  return contacts.filter((contact) => {
    for (const rule of rules) {
      if (!rule.value.trim()) continue;
      if (rule.field === "stage") {
        const stageIds = rule.value.split(",").filter(Boolean);
        if (stageIds.length && (!contact.stage_id || !stageIds.includes(contact.stage_id))) return false;
        continue;
      }
      if (rule.field === "last_touch") {
        const days = parseLastTouchDays(rule.value);
        if (days && !lastTouchIsOlderThan(lastTouchById.get(contact.id), days, now)) return false;
        continue;
      }
      const parsed = parseTagOrListValue(rule.value);
      if (!parsed) continue;
      if (parsed.kind === "tag") {
        const hasTag = contact.contact_tags.some((row) => row.tags?.id === parsed.id);
        if (!hasTag) return false;
      } else {
        const members = listMembersById.get(parsed.id) ?? [];
        if (!members.includes(contact.id)) return false;
      }
    }
    return true;
  });
}

export function buildSmartListTextNextLeads(
  contacts: { id: string; first_name: string; last_name: string | null; phone: string | null; lead_source: string | null; lead_date?: string | null }[],
): TextAndNextLead[] {
  return contacts
    .filter((contact) => hasUsablePhone(contact.phone))
    .map((contact) => ({
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name ?? "",
      name: contactDisplayName(contact),
      phone: contact.phone,
      leadDate: contact.lead_date ?? null,
      sourceChip: "Smart list",
      draft: applyMergeFields(SMART_LIST_FOLLOWUP_TEMPLATE, {
        first_name: contact.first_name,
        last_name: contact.last_name ?? "",
      }),
      autoFillNote: "Follow-up draft for this smart list. Edit before you send.",
    }));
}
