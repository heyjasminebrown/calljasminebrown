import type { ContactSort } from "@/lib/data/contacts";
import type { ContactQueue } from "@/lib/crm/contact-queues";
import type { ContactGender } from "@/lib/crm/contact-gender";

export type ContactGroupBy = "none" | "stage" | "tag" | "source" | "month";

// URL sentinels for registration. Contacts v2 browse is everyone by default
// (Zillow, referrals, events, and more) — missing/empty regEvent applies
// no registration predicate. Explicit any-event is __any__; opt-out is __all__.
export const REGISTERED_FOR_ANY_EVENT = "__any__";
export const NOT_FILTERED_BY_REGISTRATION = "__all__";
export const EVER_ATTENDED_EVENT = "__any__";

export function resolveRegisteredEventName(sp: URLSearchParams): string | undefined {
  const raw = sp.get("regEvent");
  if (!raw || raw === NOT_FILTERED_BY_REGISTRATION) return undefined;
  if (raw === REGISTERED_FOR_ANY_EVENT) return REGISTERED_FOR_ANY_EVENT;
  return raw;
}

export function registrationSelectValue(sp: URLSearchParams): string {
  return resolveRegisteredEventName(sp) ?? NOT_FILTERED_BY_REGISTRATION;
}

export type ContactFilterParams = {
  q?: string;
  stageId?: string;
  tagIds?: string[];
  type?: string;
  timeline?: string;
  representing?: string;
  leadSource?: string;
  stageIds?: string[];
  gender?: ContactGender;
  hasPhone?: boolean;
  missingPhone?: boolean;
  hasEmail?: boolean;
  missingEmail?: boolean;
  hasFollowUp?: boolean;
  missingFollowUp?: boolean;
  overdueFollowUp?: boolean;
  archived?: "active" | "archived" | "all";
  hasNotes?: boolean;
  missingNotes?: boolean;
  birthdayMonth?: number;
  city?: string;
  state?: string;
  minBudget?: number;
  notSyncedQuo?: boolean;
  eventName?: string;
  registeredEventName?: string;
  likelihood?: "high" | "medium" | "low";
  queue?: ContactQueue;
  leadDateWithinDays?: number;
  leadDateFrom?: string;
  leadDateTo?: string;
  groupBy?: ContactGroupBy;
  sort?: ContactSort;
  includeIds?: string[];
  lastTouchOlderThanDays?: number;
  inListIds?: string[];
};

// Single source of truth for reading contact-list query params, used by
// both the Contacts page and the CSV export route - keeping this in one
// place is what stops the two from silently drifting apart the way the
// export route almost did when it was first hand-rolled separately.
export function parseContactFilterParams(sp: URLSearchParams): ContactFilterParams {
  const followup = sp.get("followup");
  const phone = sp.get("phone");
  const email = sp.get("email");
  const notes = sp.get("notes");
  const stageIds = sp.get("stage")?.split(",").filter(Boolean);

  return {
    q: sp.get("q") ?? undefined,
    stageId: stageIds?.[0],
    stageIds,
    tagIds: sp.get("tags") ? sp.get("tags")!.split(",").filter(Boolean) : undefined,
    type: sp.get("type") ?? undefined,
    timeline: sp.get("timeline") ?? undefined,
    representing: sp.get("representing") ?? undefined,
    leadSource: sp.get("source") ?? undefined,
    gender: parseContactGender(sp.get("gender")),
    hasPhone: phone === "1",
    missingPhone: phone === "0",
    hasEmail: email === "1",
    missingEmail: email === "0",
    hasFollowUp: followup === "1",
    missingFollowUp: followup === "0",
    overdueFollowUp: followup === "overdue",
    archived: (sp.get("archived") as ContactFilterParams["archived"]) ?? undefined,
    hasNotes: notes === "1",
    missingNotes: notes === "0",
    birthdayMonth: sp.get("birthdayMonth") ? Number(sp.get("birthdayMonth")) : undefined,
    city: sp.get("city") ?? undefined,
    state: sp.get("state") ?? undefined,
    minBudget: sp.get("minBudget") ? Number(sp.get("minBudget")) : undefined,
    notSyncedQuo: sp.get("quoSync") === "0",
    eventName: sp.get("event") ?? undefined,
    registeredEventName: resolveRegisteredEventName(sp),
    likelihood: (sp.get("likelihood") as ContactFilterParams["likelihood"]) ?? undefined,
    queue: (sp.get("queue") as ContactQueue) ?? undefined,
    leadDateWithinDays: sp.get("newSince") ? Number(sp.get("newSince")) : undefined,
    leadDateFrom: sp.get("leadFrom") ?? undefined,
    leadDateTo: sp.get("leadTo") ?? undefined,
    groupBy: (sp.get("group") as ContactGroupBy) ?? undefined,
    sort: (sp.get("sort") as ContactSort) ?? undefined,
    includeIds: sp.get("ids") ? sp.get("ids")!.split(",").filter(Boolean) : undefined,
    lastTouchOlderThanDays: parsePositiveDays(sp.get("lastTouch")),
    inListIds: sp.get("inList") ? sp.get("inList")!.split(",").filter(Boolean) : undefined,
  };
}

export const SHEET_PARAM_KEYS = [
  "stage", "type", "tags", "source", "timeline", "representing", "likelihood",
  "phone", "email", "followup", "notes", "newSince", "leadFrom", "leadTo",
  "event", "regEvent", "gender", "city", "state", "birthdayMonth", "minBudget", "archived", "quoSync", "group",
] as const;

export const CONTACTS_V2_FILTER_KEYS = ["source", "stage", "event", "gender", "phone"] as const;

function parseContactGender(raw: string | null): ContactGender | undefined {
  if (raw === "women" || raw === "men" || raw === "unknown") return raw;
  return undefined;
}

function parsePositiveDays(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  return Math.floor(days);
}

export function parseIncludeIds(raw: string | null | undefined): string[] {
  return raw ? raw.split(",").map((id) => id.trim()).filter(Boolean) : [];
}

export function mergeIncludeIds(existing: string | null | undefined, extra: string[]): string {
  return [...new Set([...parseIncludeIds(existing), ...extra])].join(",");
}
