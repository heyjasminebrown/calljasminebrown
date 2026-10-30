import { NextResponse, type NextRequest } from "next/server";
import { google } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/google/oauth";

// Google's redirect back here is a cross-site navigation, which some
// browsers don't reliably carry cookies across - so this route doesn't
// depend on a recognized Supabase session (see middleware.ts) or on a
// cookie for the CSRF-style state check. Instead the state value is
// recorded server-side by /connect and looked up here, single-use. Since
// this is a single-owner CRM, CRM_OWNER_USER_ID is who the tokens belong
// to - no session needed to know that either.
export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    settingsUrl.searchParams.set("gmail_error", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state) {
    settingsUrl.searchParams.set("gmail_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  const ownerId = process.env.CRM_OWNER_USER_ID;
  if (!ownerId) {
    console.error("Gmail OAuth callback: CRM_OWNER_USER_ID isn't set");
    settingsUrl.searchParams.set("gmail_error", "exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const admin = createAdminClient();

  const { data: pending } = await admin.from("gmail_oauth_states").select("created_at").eq("state", state).maybeSingle();
  await admin.from("gmail_oauth_states").delete().eq("state", state);
  const isExpired = !pending || Date.now() - new Date(pending.created_at).getTime() > 10 * 60_000;
  if (isExpired) {
    settingsUrl.searchParams.set("gmail_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      // Google only issues a refresh_token on first-ever consent (or when
      // prompt=consent forces it, which getGoogleAuthUrl already sets) -
      // missing one here means she'll need to revoke access at
      // myaccount.google.com/permissions and reconnect from scratch.
      settingsUrl.searchParams.set("gmail_error", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    const client = new google.auth.OAuth2();
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: "v2" });
    const { data: profile } = await oauth2.userinfo.get();

    await admin.from("gmail_accounts").upsert(
      {
        owner_id: ownerId,
        email_address: profile.email ?? "unknown",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: new Date(tokens.expiry_date ?? Date.now() + 55 * 60_000).toISOString(),
      },
      { onConflict: "owner_id" },
    );

    settingsUrl.searchParams.set("gmail_connected", "1");
  } catch (err) {
    console.error("Gmail OAuth callback failed", err);
    settingsUrl.searchParams.set("gmail_error", "exchange_failed");
  }

  return NextResponse.redirect(settingsUrl);
}
