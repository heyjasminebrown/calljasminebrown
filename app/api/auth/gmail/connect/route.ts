import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuthUrl } from "@/lib/google/oauth";

// The middleware already requires a logged-in session to reach this route,
// but double-check here too since it writes to gmail_accounts on the
// callback and shouldn't ever run for a signed-out request.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomUUID();
  const admin = createAdminClient();
  // Recorded server-side and verified on callback as basic CSRF protection
  // - not a cookie, since Google's redirect back is a cross-site
  // navigation some browsers don't reliably carry cookies across. The
  // actual owner is always re-derived from CRM_OWNER_USER_ID, never from
  // this value.
  await admin.from("gmail_oauth_states").delete().lt("created_at", new Date(Date.now() - 60 * 60_000).toISOString());
  await admin.from("gmail_oauth_states").insert({ state });

  return NextResponse.redirect(getGoogleAuthUrl(state));
}
