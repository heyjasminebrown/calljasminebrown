import type { WorklistPerson } from "@/lib/data/today";

// Today home does not render Up Next. Calls/owed groups passed in are
// already spam-filtered in getTodayData, so a robocall cannot win the hero
// if this is ever called again.
export function pickUpNext(groups: {
  late: WorklistPerson[];
  dueToday: WorklistPerson[];
  owed: WorklistPerson[];
}): { item: (WorklistPerson & { source: "call" | "reply" }) | null; reason: string } {
  if (groups.late[0]) return { item: { ...groups.late[0], source: "call" }, reason: groups.late[0].meta };
  if (groups.dueToday[0]) return { item: { ...groups.dueToday[0], source: "call" }, reason: "Due today" };
  if (groups.owed[0]) return { item: { ...groups.owed[0], source: "reply" }, reason: "Owed a reply" };
  return { item: null, reason: "" };
}

export function countDistinctPeople(...idLists: (string | null | undefined)[][]): number {
  const ids = new Set<string>();
  for (const list of idLists) {
    for (const id of list) {
      if (id) ids.add(id);
    }
  }
  return ids.size;
}

export function countTodayOpenItems(today: {
  calls: { id: string }[];
  repliesOwed: { id: string }[];
  myTasks: { contactId: string | null }[];
  newLeads: { id: string }[];
  registeredNoFollowUp: { id: string }[];
  bookingRequests: { contact_id: string | null }[];
  abandonedBookings?: { contact_id: string | null }[];
  quietLeads?: { id: string }[];
}): number {
  return countDistinctPeople(
    today.calls.map((c) => c.id),
    today.repliesOwed.map((c) => c.id),
    today.myTasks.map((t) => t.contactId),
    today.newLeads.map((c) => c.id),
    today.registeredNoFollowUp.map((c) => c.id),
    today.bookingRequests.map((r) => r.contact_id),
    (today.abandonedBookings ?? []).map((r) => r.contact_id),
    (today.quietLeads ?? []).map((c) => c.id),
  );
}
