"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGmailInbox } from "@/lib/google/sync-inbox";

export type GmailSyncNowResult =
  | { ok: true; synced: number; checked: number; firstSync: boolean; unmatchedSenders: string[]; skipped?: string }
  | { ok: false; error: string };

// Same sync the 15-minute cron runs, on demand from Settings, returning
// what it saw so a missing email can be explained on the spot.
export async function syncGmailNow(): Promise<GmailSyncNowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  try {
    const result = await syncGmailInbox(createAdminClient(), user.id);
    if ("skipped" in result) {
      return { ok: true, synced: 0, checked: 0, firstSync: false, unmatchedSenders: [], skipped: result.skipped };
    }
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
