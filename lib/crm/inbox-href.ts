import { parseMessagesFilter } from "@/lib/crm/messages-v1";

export function inboxHref(opts?: { filter?: string | null; hidden?: boolean; spam?: boolean; q?: string | null }): string {
  const params = new URLSearchParams();
  if (opts?.filter) {
    const filter = parseMessagesFilter(opts.filter === "owed" ? "needs" : opts.filter);
    if (filter !== "needs") params.set("filter", filter);
  }
  if (opts?.hidden) params.set("hidden", "1");
  if (opts?.spam) params.set("spam", "1");
  if (opts?.q) params.set("q", opts.q);
  const qs = params.toString();
  return qs ? `/messages?${qs}` : "/messages";
}

export function threadHref(
  contactId: string,
  opts?: { filter?: string | null; hidden?: boolean; spam?: boolean; q?: string | null },
): string {
  const params = new URLSearchParams();
  if (opts?.filter) {
    const filter = parseMessagesFilter(opts.filter === "owed" ? "needs" : opts.filter);
    if (filter !== "needs") params.set("from", filter);
  }
  if (opts?.hidden) params.set("hidden", "1");
  if (opts?.spam) params.set("spam", "1");
  if (opts?.q) params.set("q", opts.q);
  const qs = params.toString();
  return qs ? `/messages/${contactId}?${qs}` : `/messages/${contactId}`;
}
