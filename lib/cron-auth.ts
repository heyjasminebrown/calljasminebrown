import type { NextRequest } from "next/server";

// Vercel Cron sends this header automatically on every scheduled
// invocation; this also lets us trigger a run manually (e.g. via curl)
// using the same secret while testing.
export function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
