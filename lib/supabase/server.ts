import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { actAsCrmOwner } from "@/lib/supabase/team-identity";

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component; safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    },
  );
  // One server request = one client, so the identity lookup is cached.
  return actAsCrmOwner(client, { cache: true });
}
