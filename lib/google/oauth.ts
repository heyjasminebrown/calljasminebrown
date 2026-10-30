import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  // Lets the CRM create Calendar events (with a Google Meet link) and email
  // the invite to an attendee - added after Gmail sync/send already
  // existed, so anyone who connected before this scope was added needs to
  // disconnect and reconnect once before scheduling a meeting will work.
  "https://www.googleapis.com/auth/calendar.events",
];

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getGoogleAuthUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token on every connect, not just the first
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Loads the stored tokens for the (single) owner, refreshes them with
// Google if expired, persists the refreshed access token back to Supabase,
// and returns an OAuth2 client ready to pass to any googleapis call - Gmail
// and Calendar both, since it's the one Google account/token pair (stored
// in gmail_accounts from when only Gmail needed it).
export async function getAuthorizedGoogleClient(admin: SupabaseClient, ownerId: string) {
  const { data: account } = await admin.from("gmail_accounts").select("*").eq("owner_id", ownerId).maybeSingle();
  if (!account) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: new Date(account.token_expiry).getTime(),
  });

  const expiresSoon = new Date(account.token_expiry).getTime() - Date.now() < 5 * 60_000;
  if (expiresSoon) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await admin
      .from("gmail_accounts")
      .update({
        access_token: credentials.access_token,
        token_expiry: new Date(credentials.expiry_date ?? Date.now() + 55 * 60_000).toISOString(),
      })
      .eq("owner_id", ownerId);
  }

  return client;
}
