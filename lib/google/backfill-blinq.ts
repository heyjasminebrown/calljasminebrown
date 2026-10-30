import { google, gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";
import { extractBlinqBodyText } from "@/lib/google/sync-inbox";
import { looksLikeBlinqShareEmail, parseBlinqShareEmail } from "@/lib/google/parse-blinq-email";
import { recordBlinqContact } from "@/lib/crm/blinq-contact";

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Caps how many messages a single click processes - each one is a real
// Gmail API round trip (format: "full", so a full HTML body every time),
// and doing them one at a time used to blow straight through Vercel's
// serverless function time limit on any real backlog, silently killing
// the request mid-run with no error the UI could show (see
// BlinqShareBackfill.tsx). Oldest-first, so a backlog larger than one
// run clears from the start across repeated clicks instead of the same
// newest handful winning every time.
const MAX_MESSAGES_PER_RUN = 40;
const CONCURRENCY = 10;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// One-time sweep of Gmail history the incremental sync (syncGmailInbox)
// never sees - that one only diffs forward from the historyId recorded
// when Gmail was first connected, so any Blinq share that arrived before
// this feature existed (or before Gmail was even connected) is invisible
// to it. Searches Gmail directly by subject instead of relying on
// history, same "catch what a webhook/live sync missed" idea as the
// other *SyncBackfill buttons in Settings.
export async function backfillBlinqShares(admin: SupabaseClient, ownerId: string): Promise<{ found: number; added: number; capped: boolean } | null> {
  const client = await getAuthorizedGoogleClient(admin, ownerId);
  if (!client) return null;

  const gmail = google.gmail({ version: "v1", auth: client });

  const messageIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q: 'subject:"has sent you their details"',
      maxResults: 100,
      pageToken,
    });
    for (const m of data.messages ?? []) {
      if (m.id) messageIds.push(m.id);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);

  const capped = messageIds.length > MAX_MESSAGES_PER_RUN;
  const toProcess = messageIds.slice().reverse().slice(0, MAX_MESSAGES_PER_RUN);

  const outcomes = await mapWithConcurrency(toProcess, CONCURRENCY, async (messageId): Promise<boolean> => {
    try {
      const { data: full } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
      const subject = headerValue(full.payload?.headers, "Subject");
      if (!looksLikeBlinqShareEmail(subject)) return false;

      const bodyText = extractBlinqBodyText(full.payload);
      const parsed = parseBlinqShareEmail(subject, bodyText);
      if (!parsed || (!parsed.email && !parsed.phone)) return false;

      await recordBlinqContact(admin, ownerId, { ...parsed, dedupeId: messageId });
      return true;
    } catch (err) {
      console.error("Blinq backfill failed for message", messageId, err);
      return false;
    }
  });

  return { found: messageIds.length, added: outcomes.filter(Boolean).length, capped };
}
