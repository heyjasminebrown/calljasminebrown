import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for server-only code that must write data with no
// logged-in user in context (webhooks). Bypasses row-level security, so
// this must never be imported into a "use client" component or route that
// runs in the browser, and SUPABASE_SERVICE_ROLE_KEY must never be
// prefixed NEXT_PUBLIC_.
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
