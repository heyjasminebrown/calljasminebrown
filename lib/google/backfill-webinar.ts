import { google, type gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";
import { extractPlainTextBody } from "@/lib/google/sync-inbox";
import { addWebsiteLead } from "@/lib/crm/website-lead";

// One-time catch-up: /conference sign-ups that reached her inbox as
// "Webinar sign-up: <name>" emails before the website sent them to the
// CRM. Same rules as the live form (new emails only, Community / Warm,
// Source "Conference"). Safe to run again: anyone already added is
// skipped by email.

const MAX_PER_RUN = 60;

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export type ParsedSignup = { firstName: string; lastName: string; email: string; phone: string | null };

// The website's email body:
//   First name: Jane / Last name: Doe / Email: jane@x.com / Phone: (404) ... | (not given)
export function parseWebinarSignup(body: string, replyTo: string): ParsedSignup | null {
  const line = (label: string) => body.match(new RegExp(`^\\s*${label}:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim() ?? "";
  const firstName = line("First name");
  const lastName = line("Last name");
  const fromReplyTo = replyTo.match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/)?.[0] ?? "";
  const email = (line("Email").match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/)?.[0] ?? fromReplyTo).toLowerCase();
  const phoneRaw = line("Phone");
  const phone = phoneRaw && /\d{3}/.test(phoneRaw) && !/not given/i.test(phoneRaw) ? phoneRaw : null;
  if (!firstName || !email) return null;
  return { firstName, lastName, email, phone };
}

export type WebinarBackfillResult = { found: number; added: number; alreadyInCrm: number; unreadable: number; failed: number; capped: boolean };

export async function backfillWebinarSignups(admin: SupabaseClient, ownerId: string): Promise<WebinarBackfillResult | null> {
  const client = await getAuthorizedGoogleClient(admin, ownerId);
  if (!client) return null;
  const gmail = google.gmail({ version: "v1", auth: client });

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.messages.list({ userId: "me", q: 'subject:"Webinar sign-up"', maxResults: 100, pageToken });
    for (const m of data.messages ?? []) if (m.id) ids.push(m.id);
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < 500);

  // Oldest first, so repeated runs work through a big backlog in order.
  const batch = ids.reverse().slice(0, MAX_PER_RUN);
  const result: WebinarBackfillResult = { found: ids.length, added: 0, alreadyInCrm: 0, unreadable: 0, failed: 0, capped: ids.length > MAX_PER_RUN };

  // One at a time: two emails from the same person must not both create.
  for (const id of batch) {
    try {
      const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const subject = headerValue(msg.payload?.headers, "Subject");
      if (!/^\s*Webinar sign-up:/i.test(subject)) {
        result.unreadable++;
        continue;
      }
      const signup = parseWebinarSignup(extractPlainTextBody(msg.payload), headerValue(msg.payload?.headers, "Reply-To"));
      if (!signup) {
        result.unreadable++;
        continue;
      }
      const signedUpAt = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : undefined;
      const outcome = await addWebsiteLead(admin, ownerId, {
        ...signup,
        source: "Conference",
        form: "heyjasminebrown.com/conference",
        signedUpAt,
      });
      if (outcome.created) result.added++;
      else result.alreadyInCrm++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
