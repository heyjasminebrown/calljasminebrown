import type { NavCounts } from "@/components/nav/nav-items";

// Shared by Sidebar (desktop) and MoreSheet/BottomNav (mobile) so the two
// don't drift into disagreeing about which counts are "waiting" ones -
// extracted from Sidebar.tsx's previously-inline map.
export function countFor(counts: NavCounts): Record<string, { value: number; waiting?: boolean } | undefined> {
  return {
    "/contacts": counts.contacts !== undefined ? { value: counts.contacts } : undefined,
    "/dialer": counts.dialer !== undefined ? { value: counts.dialer } : undefined,
    "/messages": counts.messages !== undefined ? { value: counts.messages, waiting: counts.messages > 0 } : undefined,
    "/notes": counts.notes !== undefined && counts.notes > 0 ? { value: counts.notes, waiting: true } : undefined,
    "/insights": counts.insights !== undefined && counts.insights > 0 ? { value: counts.insights, waiting: true } : undefined,
  };
}
