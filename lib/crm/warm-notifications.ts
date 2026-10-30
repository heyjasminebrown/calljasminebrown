import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyNewLead } from "@/lib/push/send-push";

const QUIET_HOURS_START = 9; // 9am
const QUIET_HOURS_END = 21; // 9pm
const APP_TIMEZONE = "America/New_York";

export function isWithinQuietHours(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false }).format(new Date()),
  );
  return hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END;
}

// Checked inline at the moment of a real open/click, not queued -
// simpler than the design's "summarize overnight activity into one
// 9am push" (that needs a poll+claim cron this app doesn't have a
// precedent for yet), so overnight activity is just suppressed rather
// than batched and delivered the next morning. A person can still see
// everything on /insights/warm whenever they next open it.
export async function checkWarmNotifications(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  sendId: string,
  event: "open" | "click",
) {
  if (!isWithinQuietHours()) return;

  const { data: settings } = await admin.from("warm_notification_settings").select("*").eq("owner_id", ownerId).maybeSingle();
  const rules = settings ?? { rule_triple_open: true, rule_past_client_click: true, rule_hot_twice: true, rule_every_open: false };

  const { data: contact } = await admin
    .from("contacts")
    .select("id, first_name, last_name, known_personally, archived, stage_id, pipeline_stages(name, is_closed_won)")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact || contact.archived || contact.known_personally) return;
  const name = `${contact.first_name} ${contact.last_name}`.trim();
  const stage = Array.isArray(contact.pipeline_stages) ? contact.pipeline_stages[0] : contact.pipeline_stages;

  if (rules.rule_every_open && event === "open") {
    await notifyNewLead(admin, ownerId, { title: name, body: "Opened your email", url: "/insights/warm" });
    return;
  }

  if (event === "open" && rules.rule_triple_open) {
    const { data: send } = await admin.from("email_sequence_sends").select("open_count").eq("id", sendId).maybeSingle();
    if (send?.open_count === 3) {
      await notifyNewLead(admin, ownerId, { title: name, body: "Opened the same email 3 times today", url: "/insights/warm" });
    }
  }

  if (event === "click" && rules.rule_past_client_click && stage?.is_closed_won) {
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId)
      .in("type", ["call", "text", "email"])
      .gte("occurred_at", sixMonthsAgo);
    if ((count ?? 0) === 0) {
      await notifyNewLead(admin, ownerId, { title: name, body: "Past client, quiet 6+ months, just clicked through", url: "/insights/warm" });
    }
  }

  if (event === "open" && rules.rule_hot_twice && stage && !stage.is_closed_won) {
    const isHot = stage.name.toLowerCase().includes("hot");
    if (isHot) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("email_sequence_sends")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .gte("opened_at", weekAgo);
      if (count === 2) {
        await notifyNewLead(admin, ownerId, { title: name, body: "Hot / Ready, opened your email twice this week", url: "/insights/warm" });
      }
    }
  }
}
