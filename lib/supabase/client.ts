import { createBrowserClient } from "@supabase/ssr";
import { actAsCrmOwner } from "@/lib/supabase/team-identity";

export function createClient() {
  // The browser client is shared across the session (sign-out/in can
  // change who's signed in), so don't cache the identity lookup.
  return actAsCrmOwner(
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    { cache: false },
  );
}
