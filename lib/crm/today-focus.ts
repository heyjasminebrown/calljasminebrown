import { applyMergeFields } from "@/lib/crm/merge-fields";
import { firstTouchTemplate } from "@/lib/crm/new-lead-text-templates";
import type { WorklistPerson } from "@/lib/data/today";
import type { getTodayData } from "@/lib/data/today";

// URL `?focus=` is the only source of truth for which Today queue is open.
// Client chip `useState` previously ignored the query string, so
// "New / uncontacted" (`/?focus=new`) highlighted the Do-next row and did
// not swap the list — especially on desktop, whose chips omitted `new`.

export const TODAY_FOCUS_KEYS = [
  "overdue",
  "call-today",
  "new",
  "quiet",
  "tasks",
  "registered",
  "meetings",
  "messages",
] as const;

export type TodayFocus = (typeof TODAY_FOCUS_KEYS)[number];

export type TodayChipKey = "late" | "dueToday" | "owed" | "tasks" | "registered" | "meetings" | "newUncontacted" | "quiet";

export const FOCUS_TO_CHIP: Record<TodayFocus, TodayChipKey> = {
  overdue: "late",
  "call-today": "dueToday",
  new: "newUncontacted",
  quiet: "quiet",
  messages: "owed",
  tasks: "tasks",
  registered: "registered",
  meetings: "meetings",
};

export const CHIP_TO_FOCUS: Record<TodayChipKey, TodayFocus> = {
  late: "overdue",
  dueToday: "call-today",
  newUncontacted: "new",
  quiet: "quiet",
  owed: "messages",
  tasks: "tasks",
  registered: "registered",
  meetings: "meetings",
};

export const TODAY_QUEUE_TITLES: Record<TodayFocus, string> = {
  overdue: "Overdue",
  "call-today": "Call today",
  new: "New / uncontacted",
  quiet: "No touch 14+ days",
  tasks: "My tasks",
  registered: "Registered",
  meetings: "Meetings",
  messages: "Owed a reply",
};

export const TODAY_QUEUE_SHORT_LABELS: Record<TodayFocus, string> = {
  overdue: "Overdue",
  "call-today": "Call today",
  new: "New",
  quiet: "Quiet",
  tasks: "My tasks",
  registered: "Registered",
  meetings: "Meetings",
  messages: "Owed a reply",
};

/** Chip switcher on a drilled-in queue — every item is a real `/?focus=` link. */
export const TODAY_QUEUE_SWITCHER: TodayFocus[] = ["overdue", "call-today", "new", "quiet", "tasks", "registered", "meetings"];

export function parseTodayFocus(value: string | undefined | null): TodayFocus | undefined {
  if (!value) return undefined;
  return (TODAY_FOCUS_KEYS as readonly string[]).includes(value) ? (value as TodayFocus) : undefined;
}

export function todayFocusHref(focus: TodayFocus): string {
  return `/?focus=${focus}`;
}

export type TodayPersonGroups = Record<"late" | "dueToday" | "owed" | "registered" | "newUncontacted" | "quiet", WorklistPerson[]>;

type TodayData = Awaited<ReturnType<typeof getTodayData>>;

export function buildTodayPersonGroups(today: TodayData): TodayPersonGroups {
  const newUncontacted: WorklistPerson[] = today.newLeads.map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`.trim(),
    phone: c.phone,
    meta: c.lead_source ? `New · ${c.lead_source}` : "New / uncontacted",
    late: false,
    smsDraft: applyMergeFields(firstTouchTemplate({ leadSource: c.lead_source, lastEventName: c.last_event_name, tagNames: c.tagNames }), {
      first_name: c.first_name,
      last_name: c.last_name,
    }),
  }));

  return {
    late: today.calls.filter((c) => c.late),
    dueToday: today.calls.filter((c) => !c.late),
    owed: today.repliesOwed,
    registered: today.registeredNoFollowUp,
    newUncontacted,
    quiet: today.quietLeads,
  };
}

export function countForFocus(
  focus: TodayFocus,
  groups: TodayPersonGroups,
  taskCount: number,
  meetingCount: number,
): number {
  const chip = FOCUS_TO_CHIP[focus];
  if (chip === "tasks") return taskCount;
  if (chip === "meetings") return meetingCount;
  return groups[chip].length;
}
