import type { NextRequest } from "next/server";
import { reportFailure } from "@/lib/errors/report-failure";

// Vercel Cron sends this header automatically on every scheduled
// invocation; this also lets us trigger a run manually (e.g. via curl)
// using the same secret while testing. A missing CRON_SECRET means every
// scheduled job is refused, so that's reported rather than left silent.
export async function isAuthorizedCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await reportFailure(
      "Scheduled jobs aren't running: CRON_SECRET isn't set in Vercel. Add it (any random string) under Settings → Environment Variables, then redeploy",
      // An object, not a string, so the path stays in details and every
      // job's refusal folds into one banner entry.
      { refused: request.nextUrl.pathname },
    );
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
