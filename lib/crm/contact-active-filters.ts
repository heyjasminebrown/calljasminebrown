import { QUEUES } from "@/lib/crm/contact-queues";
import {
  EVER_ATTENDED_EVENT,
  NOT_FILTERED_BY_REGISTRATION,
  REGISTERED_FOR_ANY_EVENT,
  registrationSelectValue,
} from "@/lib/crm/contact-filter-params";
import { SHEET_PARAM_KEYS } from "@/lib/crm/contact-filter-params";
import { sourceFilterByValue } from "@/lib/crm/contact-sources";
import type { PipelineStage, Tag } from "@/types/database";

export type ActiveFilterTag = { key: string; label: string };

const PARAM_LABELS: Record<string, string> = {
  source: "Source",
  stage: "Stage",
  type: "Type",
  tags: "Tag",
  timeline: "Timeline",
  representing: "Side",
  likelihood: "Likelihood",
  phone: "Phone",
  email: "Email",
  followup: "Follow-up",
  notes: "Notes",
  newSince: "Lead date",
  leadFrom: "From",
  leadTo: "To",
  event: "Attended",
  regEvent: "Registered",
  gender: "Gender",
  city: "City",
  state: "State",
  birthdayMonth: "Birthday",
  minBudget: "Min budget",
  archived: "Status",
  quoSync: "Quo",
  queue: "Queue",
  lastTouch: "Last touch",
  inList: "List",
};

export function activeFilterTags(
  sp: URLSearchParams,
  stages: PipelineStage[],
  tags: Tag[],
): ActiveFilterTag[] {
  const out: ActiveFilterTag[] = [];

  function push(key: string, raw: string) {
    const label = formatFilterValue(key, raw, stages, tags);
    if (label) out.push({ key, label });
  }

  for (const key of SHEET_PARAM_KEYS) {
    const raw = sp.get(key);
    if (!raw) continue;
    if (key === "group" && raw === "none") continue;
    if (key === "archived" && raw === "active") continue;
    if (key === "regEvent" && raw === NOT_FILTERED_BY_REGISTRATION) continue;
    if (key === "tags") {
      for (const id of raw.split(",").filter(Boolean)) {
        const tag = tags.find((t) => t.id === id);
        out.push({ key: `tags:${id}`, label: `Tag: ${tag?.name ?? id}` });
      }
      continue;
    }
    push(key, raw);
  }

  const queue = sp.get("queue");
  if (queue) {
    const q = QUEUES.find((item) => item.value === queue);
    out.push({ key: "queue", label: q?.label ?? queue });
  }

  const lastTouch = sp.get("lastTouch");
  if (lastTouch) out.push({ key: "lastTouch", label: `Last touch older than ${lastTouch} days` });

  const inList = sp.get("inList");
  if (inList) out.push({ key: "inList", label: "In saved list" });

  const reg = registrationSelectValue(sp);
  if (reg === REGISTERED_FOR_ANY_EVENT && !sp.get("regEvent") && !out.some((t) => t.key === "regEvent")) {
    // Default Tess browse is not an explicit removable chip.
  }

  return out;
}

function formatFilterValue(key: string, raw: string, stages: PipelineStage[], tags: Tag[]): string | null {
  if (key === "stage") {
    const names = raw.split(",").filter(Boolean).map((id) => stages.find((s) => s.id === id)?.name ?? id);
    return names.length ? `Stage: ${names.join(", ")}` : null;
  }
  if (key === "phone") return raw === "1" ? "Has phone" : raw === "0" ? "No phone" : null;
  if (key === "email") return raw === "1" ? "Has email" : raw === "0" ? "No email" : null;
  if (key === "event") return raw === EVER_ATTENDED_EVENT ? "Ever attended" : `Attended: ${raw}`;
  if (key === "regEvent") {
    if (raw === REGISTERED_FOR_ANY_EVENT) return "Registered: any event";
    if (raw === NOT_FILTERED_BY_REGISTRATION) return null;
    return `Registered: ${raw}`;
  }
  if (key === "likelihood") return raw === "high" ? "Hot" : raw === "medium" ? "Warm" : raw === "low" ? "Cold" : raw;
  if (key === "newSince") return `Last ${raw} days`;
  if (key === "source") {
    const bucket = sourceFilterByValue(raw);
    return `Source: ${bucket?.label ?? raw}`;
  }
  if (key === "gender") {
    if (raw === "women") return "Gender: Women";
    if (raw === "men") return "Gender: Men";
    if (raw === "unknown") return "Gender: Unknown";
    return null;
  }
  const prefix = PARAM_LABELS[key];
  return prefix ? `${prefix}: ${raw}` : raw;
}

export function removeActiveFilter(sp: URLSearchParams, key: string): URLSearchParams {
  const next = new URLSearchParams(sp.toString());
  if (key.startsWith("tags:")) {
    const id = key.slice(5);
    const remaining = (next.get("tags") ?? "").split(",").filter((t) => t && t !== id);
    if (remaining.length) next.set("tags", remaining.join(","));
    else next.delete("tags");
    return next;
  }
  next.delete(key);
  return next;
}
