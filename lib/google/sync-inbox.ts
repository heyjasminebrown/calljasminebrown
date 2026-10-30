import { google, gmail_v1 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";
import { upsertActivity } from "@/lib/crm/activities";
import { analyzeContactActivity } from "@/lib/ai/analyze-contact";
import { looksLikeBlinqShareEmail, parseBlinqShareEmail } from "@/lib/google/parse-blinq-email";
import { recordBlinqContact } from "@/lib/crm/blinq-contact";

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Pulls just the email address out of a "Name <email@x.com>" header value,
// or returns a bare "email@x.com" header unchanged.
function extractEmails(headerVal: string): string[] {
  const matches = headerVal.match(/[^\s<>,"]+@[^\s<>,"]+/g);
  return (matches ?? []).map((e) => e.toLowerCase());
}

export function extractPlainTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  for (const part of payload.parts ?? []) {
    const found = extractPlainTextBody(part);
    if (found) return found;
  }
  // Fall back to an HTML part with tags stripped, rather than nothing.
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf-8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function findHtmlBody(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!payload) return null;
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64").toString("utf-8");
    return html
      .replace(/&nbsp;/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  for (const part of payload.parts ?? []) {
    const found = findHtmlBody(part);
    if (found) return found;
  }
  return null;
}

// Confirmed against a real share notification: Blinq's plain-text
// alternative part ships with the actual merge fields (name/phone/email)
// blank, while the HTML part carries them correctly - the opposite of the
// usual "plain text is the reliable fallback" assumption extractPlainTextBody
// makes for everything else synced here. Blinq parsing reads the HTML part
// directly instead, only falling back to the (likely still-broken) plain
// text if no HTML part exists at all.
export function extractBlinqBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  return findHtmlBody(payload) ?? extractPlainTextBody(payload);
}

// Only logs mail to/from a contact already in the CRM - no classification
// needed, no marketing/spam to filter, since the address itself is the
// filter. New leads are added to the CRM by hand, not discovered here -
// with one deliberate exception: Blinq's own "X has sent you their
// details" share notifications are recognized by subject and parsed
// directly, since the sender there is Blinq itself, never a real
// contact (see the Blinq branch below).
export async function syncGmailInbox(admin: SupabaseClient, ownerId: string) {
  const { data: account } = await admin.from("gmail_accounts").select("*").eq("owner_id", ownerId).maybeSingle();
  if (!account) return { synced: 0, skipped: "not_connected" as const };

  const client = await getAuthorizedGoogleClient(admin, ownerId);
  if (!client) return { synced: 0, skipped: "not_connected" as const };

  const gmail = google.gmail({ version: "v1", auth: client });
  const myEmail = account.email_address.toLowerCase();

  // First sync after connecting has no baseline to diff against - record
  // the current historyId and start fresh from here rather than backfilling
  // however many years of old mail already sit in the inbox.
  if (!account.last_history_id) {
    const { data: profile } = await gmail.users.getProfile({ userId: "me" });
    await admin.from("gmail_accounts").update({ last_history_id: profile.historyId }).eq("owner_id", ownerId);
    return { synced: 0, skipped: "baseline_set" as const };
  }

  const { data: contacts } = await admin.from("contacts").select("id, email").eq("owner_id", ownerId).not("email", "is", null);
  const contactByEmail = new Map((contacts ?? []).map((c) => [c.email!.toLowerCase(), c.id]));

  let messageIds = new Set<string>();
  let pageToken: string | undefined;
  let newHistoryId = account.last_history_id;

  try {
    do {
      const { data: history } = await gmail.users.history.list({
        userId: "me",
        startHistoryId: account.last_history_id,
        historyTypes: ["messageAdded"],
        pageToken,
      });
      for (const record of history.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id) messageIds.add(added.message.id);
        }
      }
      if (history.historyId) newHistoryId = history.historyId;
      pageToken = history.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    // A 404 here means the stored historyId aged out of Gmail's retention
    // window (it only keeps ~1 week) - re-baseline instead of failing
    // forever on every future run.
    console.error("Gmail history.list failed", err);
    const { data: profile } = await gmail.users.getProfile({ userId: "me" });
    await admin.from("gmail_accounts").update({ last_history_id: profile.historyId }).eq("owner_id", ownerId);
    return { synced: 0, skipped: "history_expired_rebaselined" as const };
  }

  let synced = 0;
  for (const messageId of messageIds) {
    try {
      const { data: meta } = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["From", "To", "Cc", "Subject"],
      });

      const from = extractEmails(headerValue(meta.payload?.headers, "From"))[0] ?? "";
      const metaSubject = headerValue(meta.payload?.headers, "Subject");
      const to = extractEmails(headerValue(meta.payload?.headers, "To"));
      const cc = extractEmails(headerValue(meta.payload?.headers, "Cc"));
      const isOutbound = from === myEmail;

      // Blinq's own free-tier "X has sent you their details" share
      // notification - the sender is Blinq, never a real contact, so this
      // has to be checked before the "not a known contact" skip below,
      // not folded into the normal per-contact activity log.
      if (!isOutbound && looksLikeBlinqShareEmail(metaSubject)) {
        const { data: full } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
        const bodyText = extractBlinqBodyText(full.payload);
        const parsed = parseBlinqShareEmail(metaSubject, bodyText);
        if (parsed && (parsed.email || parsed.phone)) {
          await recordBlinqContact(admin, ownerId, { ...parsed, dedupeId: messageId });
          synced++;
        }
        continue;
      }

      const counterpartEmails = isOutbound ? [...to, ...cc] : [from];
      const contactId = counterpartEmails.map((e) => contactByEmail.get(e)).find(Boolean);
      if (!contactId) continue;

      const { data: full } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
      const subject = headerValue(full.payload?.headers, "Subject");
      const bodyText = extractPlainTextBody(full.payload).slice(0, 5000);
      const occurredAt = full.internalDate ? new Date(Number(full.internalDate)).toISOString() : new Date().toISOString();

      await upsertActivity(admin, ownerId, contactId, "gmail", "gmail_message_id", messageId, {
        type: "email",
        direction: isOutbound ? "outbound" : "inbound",
        occurred_at: occurredAt,
        body: subject ? `${subject}\n\n${bodyText}` : bodyText,
        metadata: { gmail_message_id: messageId, subject },
      });

      if (!isOutbound && bodyText) {
        await analyzeContactActivity(admin, ownerId, contactId, { type: "email", direction: "inbound", content: bodyText });
      }

      synced++;
    } catch (err) {
      console.error("Failed to sync Gmail message", messageId, err);
    }
  }

  await admin.from("gmail_accounts").update({ last_history_id: newHistoryId }).eq("owner_id", ownerId);
  return { synced };
}
