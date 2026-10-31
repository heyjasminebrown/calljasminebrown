import { createAdminClient } from "@/lib/supabase/admin";
import { notifyNewLead } from "@/lib/push/send-push";

const MAX_DETAILS = 20_000;

function describe(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Replaces a bare console.error for anything that runs in the background
// (webhooks, cron jobs, integrations), where nobody is watching the
// response. Logs to Vercel as before, and also records the failure so the
// CRM shows it - with the exact error - in a banner until dismissed, plus
// a push notification the first time it happens.
//
// `message` is the headline ("Quo text: no contact matched or created").
// The first Error among `extra` (or a short leading string reason) is
// appended to the headline, so the exact error is visible without opening
// details. Never throws.
export async function reportFailure(message: string, ...extra: unknown[]): Promise<void> {
  console.error(message, ...extra);

  const ownerId = process.env.CRM_OWNER_USER_ID;
  if (!ownerId) return;

  const firstError = extra.find((e): e is Error => e instanceof Error);
  const shortReason = typeof extra[0] === "string" && extra[0].length <= 300 ? extra[0] : null;
  const reason = firstError?.message ?? shortReason;
  const headline = reason ? `${message}: ${reason}` : message;
  const source = message.split(/[\s:]/)[0] || "System";
  const details = extra.length ? extra.map(describe).join("\n\n").slice(0, MAX_DETAILS) : null;

  try {
    const admin = createAdminClient();
    const { data: open } = await admin
      .from("system_errors")
      .select("id, occurrences")
      .eq("owner_id", ownerId)
      .eq("message", headline)
      .is("resolved_at", null)
      .limit(1)
      .maybeSingle();

    if (open) {
      await admin
        .from("system_errors")
        .update({ occurrences: open.occurrences + 1, last_seen_at: new Date().toISOString(), details })
        .eq("id", open.id);
      return;
    }

    const { error } = await admin.from("system_errors").insert({ owner_id: ownerId, source, message: headline, details });
    if (error) {
      console.error("reportFailure: couldn't record failure", error.message);
      return;
    }
    await notifyNewLead(admin, ownerId, { title: `CRM error: ${source}`, body: headline.slice(0, 180), url: "/" });
  } catch (err) {
    console.error("reportFailure: couldn't record failure", err);
  }
}
