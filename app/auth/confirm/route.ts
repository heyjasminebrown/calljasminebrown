import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AUTH_NEXT_COOKIE, safeInternalPath } from "@/lib/auth/safe-path";

// Verifies the magic-link token directly against Supabase (token_hash),
// instead of exchanging a PKCE `code`. The PKCE code exchange requires a
// verifier stored in a cookie on the same browser that requested the link,
// which breaks when the link is opened in a different browser/app (e.g. an
// email app's in-app browser). token_hash verification has no such
// same-browser requirement.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalPath(searchParams.get("next") || request.cookies.get(AUTH_NEXT_COOKIE)?.value);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=auth");
}
