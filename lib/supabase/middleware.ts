import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_NEXT_COOKIE, safeInternalPath } from "@/lib/auth/safe-path";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tools and old docs sometimes guess /auth/login. The branded magic-link
  // page is /login; /auth/* is otherwise a session bypass (confirm callback).
  if (request.nextUrl.pathname === "/auth/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  // The QR check-in page - scanned by attendees' own phones, not the
  // logged-in agent, so it must be reachable without a session.
  const isCheckIn = request.nextUrl.pathname.startsWith("/checkin");
  // The shared house-hack quote one-pager - opened by whoever she texted
  // or emailed it to, not the logged-in agent, so it must be reachable
  // without a session too.
  const isPublicQuote = request.nextUrl.pathname.startsWith("/n/");
  // The self-serve scheduling page - opened by whoever she texted the
  // link to, not the logged-in agent, so it must be reachable without a
  // session too. The bare "/book" (no trailing slash) is the easy
  // generic address, distinct from "/book/{slug}" contact links - both
  // need the bypass.
  // /public-book is the alias the marketing site rewrites to. Middleware
  // runs before beforeFiles rewrites, so the alias must be public too or
  // visitors are bounced to /login before the rewrite to /book.
  const isPublicBooking =
    request.nextUrl.pathname === "/book" ||
    request.nextUrl.pathname.startsWith("/book/") ||
    request.nextUrl.pathname === "/public-book" ||
    request.nextUrl.pathname.startsWith("/public-book/");
  // The "confirm this time?" page for a proposed-new-time text - opened by
  // the visitor from that text, not the logged-in agent.
  const isPublicConfirm = request.nextUrl.pathname.startsWith("/confirm/");
  // Her own "Zillow-type" public marketing page for an off-MLS listing
  // (/listing overview + /listing/[slug]) - opened by an agent or investor
  // she shared the link with, not the logged-in agent. Distinct from the
  // authenticated /listings (plural) reverse-prospecting section.
  // /public-listings is the pre-rewrite alias, same as /public-book.
  const isPublicListing =
    request.nextUrl.pathname === "/listing" ||
    request.nextUrl.pathname.startsWith("/listing/") ||
    request.nextUrl.pathname === "/public-listings" ||
    request.nextUrl.pathname.startsWith("/public-listings/");
  // Webhooks (Quo, and any future integration) authenticate via their own
  // signature, not a Supabase session - they must bypass the login guard.
  // Same for cron jobs (authenticate via CRON_SECRET, no browser session),
  // the unsubscribe link and open/click tracking links (clicked by a
  // contact, not the logged-in agent - without this exemption an anonymous
  // recipient clicking a tracked link gets bounced to /login instead of
  // their actual destination), and the Gmail OAuth callback - Google's
  // redirect back is a cross-site navigation, and some browsers don't
  // reliably resend the session cookie on that hop, so that route verifies
  // the request itself (state cookie) instead of relying on a recognized
  // session.
  const isWebhook =
    request.nextUrl.pathname.startsWith("/api/webhooks") ||
    request.nextUrl.pathname.startsWith("/api/cron") ||
    request.nextUrl.pathname.startsWith("/api/unsubscribe") ||
    request.nextUrl.pathname.startsWith("/api/track") ||
    request.nextUrl.pathname.startsWith("/api/auth/gmail/callback");
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/manifest.json") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/crm-static") ||
    request.nextUrl.pathname.startsWith("/favicon") ||
    request.nextUrl.pathname.startsWith("/sw.js") ||
    request.nextUrl.pathname === "/robots.txt" ||
    request.nextUrl.pathname === "/sitemap.xml";

  if (isAuthCallback || isWebhook || isCheckIn || isPublicQuote || isPublicBooking || isPublicConfirm || isPublicListing) {
    return response;
  }

  if (!user && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    const response = NextResponse.redirect(url);
    if (next && next !== "/" && !next.startsWith("/login")) {
      response.cookies.set(AUTH_NEXT_COOKIE, safeInternalPath(next), {
        path: "/",
        maxAge: 10 * 60,
        sameSite: "lax",
        httpOnly: true,
      });
    }
    return response;
  }

  if (user && isAuthRoute) {
    // A failed magic link redirects here with ?error=auth. If we bounce a
    // still-signed-in user straight to Today, that error never appears and
    // it looks like the link "did nothing." Let the login page show it.
    if (request.nextUrl.searchParams.get("error") === "auth") {
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
