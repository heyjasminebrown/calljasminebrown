export const SNOOZE_OPTIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 30, label: "30 days" },
] as const;

export type SnoozeDays = (typeof SNOOZE_OPTIONS)[number]["days"];
