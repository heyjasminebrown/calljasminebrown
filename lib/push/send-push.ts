import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// Fired for real-time, one-at-a-time events only (a form submission, a
// first-time caller/texter, an event registration whether new or
// returning) - never for bulk operations like CSV import, which would
// blast one push per row the same way the sequence-burst spam incident
// did for email.
export async function notifyNewLead(
  admin: SupabaseClient,
  ownerId: string,
  payload: { title: string; body: string; url: string },
) {
  if (!ensureConfigured()) return;

  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("owner_id", ownerId);
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404/410 = the browser/device unsubscribed or the subscription
        // expired - stop trying to reach it instead of failing forever.
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push send failed", sub.id, err);
        }
      }
    }),
  );
}
