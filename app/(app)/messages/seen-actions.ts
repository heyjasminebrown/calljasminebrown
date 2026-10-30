"use server";

import { cookies } from "next/headers";
import { INBOX_SEEN_COOKIE, markInboxSeen, parseInboxSeen } from "@/lib/crm/inbox-seen";

export async function markInboxThreadSeen(contactId: string) {
  if (!contactId) return;
  const store = await cookies();
  const next = markInboxSeen(parseInboxSeen(store.get(INBOX_SEEN_COOKIE)?.value), contactId);
  store.set(INBOX_SEEN_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}
