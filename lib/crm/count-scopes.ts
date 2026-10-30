// Three different "how many people" numbers in this CRM. They disagree
// on purpose. Never collapse them into one fake total.

export const COUNT_SCOPE = {
  contacts:
    "This number is whoever matches the current Contacts filters (everyone by default — Zillow, referrals, events, and more). Not archived, not spam.",
  pipeline:
    "This number is people in active stages only (not closed, lost, or trash). Not archived, not spam. Closed stages can still appear as columns below — they are not in this count.",
  reports:
    "Totals here are all non-archived contacts, every stage (including closed). Not filtered the way Contacts is, and not Pipeline's active-stage count.",
} as const;

export type CountScopeId = keyof typeof COUNT_SCOPE;

export const COUNT_SCOPE_DISAGREE =
  "Contacts, Pipeline, and Reports count different people on purpose — these totals are not supposed to match.";

export const COUNT_SCOPE_LABEL: Record<CountScopeId, string> = {
  contacts: "Contacts list",
  pipeline: "Pipeline active stages",
  reports: "Reports · all non-archived",
};
