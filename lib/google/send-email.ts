import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";
import { EMAIL_SENDER_NAME } from "@/lib/brand/identity";

// Single-owner app - the "From" name is always the owner's (see
// lib/brand/identity.ts). Without this, the raw MIME From header is just
// the bare address, and mail clients show that instead of a name.
const SENDER_NAME = EMAIL_SENDER_NAME;

function encodeSubject(subject: string) {
  // RFC 2047 encoded-word, so non-ASCII subjects (names, punctuation) don't
  // get mangled - plain ASCII subjects pass through unchanged either way.
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

function buildRawMessage(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  extraHeaders?: Record<string, string>,
) {
  const message = [
    `From: "${SENDER_NAME}" <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    ...Object.entries(extraHeaders ?? {}).map(([key, value]) => `${key}: ${value}`),
    "",
    htmlBody,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
}

// Plain-text content in, simple HTML out - real estate follow-ups and
// sequence emails are short and conversational, not richly formatted, so a
// paragraph/line-break conversion is enough rather than a full editor.
export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// A hung messages.send used to sit until the page / cron 60s maxDuration.
// Fail inside that window so callers get { ok:false } instead of a killed action.
const GMAIL_SEND_TIMEOUT_MS = 20_000;

const GMAIL_RECONNECT_ERROR = "Gmail connection expired. Reconnect in Settings.";
const GMAIL_TIMEOUT_ERROR = "Gmail took too long to respond. Try again.";

function errorDetails(err: unknown, depth = 0): { name: string; code: string; text: string } {
  if (typeof err === "string") return { name: "", code: "", text: err };
  if (!err || typeof err !== "object") return { name: "", code: "", text: "" };

  const record = err as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    cause?: unknown;
    response?: { data?: unknown };
  };
  let dataText = "";
  if (record.response?.data != null) {
    try {
      dataText = typeof record.response.data === "string" ? record.response.data : JSON.stringify(record.response.data);
    } catch {
      dataText = "";
    }
  }
  const causeText = depth < 2 && record.cause && record.cause !== err ? errorDetails(record.cause, depth + 1).text : "";
  return {
    name: typeof record.name === "string" ? record.name : "",
    code: record.code != null ? String(record.code) : "",
    text: [record.message, dataText, causeText].filter((part) => typeof part === "string" && part).join(" "),
  };
}

function isExpiredGmailGrant(details: { text: string }): boolean {
  const lower = details.text.toLowerCase();
  return (
    lower.includes("invalid_grant") ||
    lower.includes("invalid grant") ||
    lower.includes("token has been expired") ||
    lower.includes("token has been revoked") ||
    lower.includes("expired or revoked")
  );
}

function isGmailTimeout(details: { name: string; code: string; text: string }): boolean {
  const lower = details.text.toLowerCase();
  return (
    details.name === "AbortError" ||
    details.name === "TimeoutError" ||
    details.code === "TimeoutError" ||
    details.code === "ECONNABORTED" ||
    details.code === "ETIMEDOUT" ||
    details.code === "ABORT_ERR" ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted")
  );
}

export function gmailSendErrorMessage(err: unknown): string {
  const details = errorDetails(err);
  if (isGmailTimeout(details)) return GMAIL_TIMEOUT_ERROR;
  if (isExpiredGmailGrant(details)) return GMAIL_RECONNECT_ERROR;
  return details.text || "Gmail send failed";
}

export async function sendGmailMessage(
  admin: SupabaseClient,
  ownerId: string,
  to: string,
  subject: string,
  htmlBody: string,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  try {
    const client = await getAuthorizedGoogleClient(admin, ownerId);
    if (!client) return { ok: false, error: "Gmail isn't connected. Connect it in Settings first." };

    const { data: account } = await admin.from("gmail_accounts").select("email_address").eq("owner_id", ownerId).maybeSingle();
    if (!account) return { ok: false, error: "Gmail isn't connected. Connect it in Settings first." };

    const gmail = google.gmail({ version: "v1", auth: client });
    const raw = buildRawMessage(account.email_address, to, subject, htmlBody, extraHeaders);
    const { data } = await gmail.users.messages.send(
      { userId: "me", requestBody: { raw } },
      // retry stays off so a hung POST cannot be attempted again and blow past ~20s.
      { timeout: GMAIL_SEND_TIMEOUT_MS, retry: false, signal: AbortSignal.timeout(GMAIL_SEND_TIMEOUT_MS) },
    );
    return { ok: true, messageId: data.id ?? "" };
  } catch (err) {
    console.error("Gmail send failed", err);
    return { ok: false, error: gmailSendErrorMessage(err) };
  }
}
