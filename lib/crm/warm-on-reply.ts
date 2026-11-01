import type { SupabaseClient } from "@supabase/supabase-js";
import { applyStageChange } from "@/lib/crm/stage-transition";
import { isOptOutMessage } from "@/lib/crm/consent";
import { isClearNo } from "@/lib/crm/text-automation";
import { reportFailure } from "@/lib/errors/report-failure";
import type { PipelineStage } from "@/types/database";

// A Cold Prospect who replies to a campaign (automated text campaign, text
// blast or email sequence) moves to Warm - unless the reply is an opt-out
// (STOP, unsubscribe) or a clear no. Only ever Cold -> Warm; every other
// type/stage is left alone.

const EMAIL_NO = [/\bunsubscribe\b/i, /\bremove me\b/i, /\btake me off\b/i, /\bstop (emailing|sending)\b/i, /\bnot interested\b/i];

// The reply itself, without the quoted campaign email underneath
// ("On Mon, ... wrote:" / "> ..." lines), which carries its own
// "Unsubscribe" link text.
function newPartOfEmail(text: string): string {
  const cut = text.search(/^\s*On .{0,200}wrote:\s*$/im);
  const head = cut >= 0 ? text.slice(0, cut) : text;
  return head
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .split(/^-{2,}\s*Original Message/im)[0]
    .trim();
}

export function isNegative(channel: "text" | "email", text: string): boolean {
  const t = channel === "email" ? newPartOfEmail(text) : text;
  if (!t) return true; // nothing they actually wrote - don't count it
  if (isOptOutMessage(t) || isClearNo(t)) return true;
  return channel === "email" && EMAIL_NO.some((re) => re.test(t));
}

async function gotCampaignBefore(admin: SupabaseClient, contactId: string, channel: "text" | "email", at: string): Promise<boolean> {
  if (channel === "text") {
    const [auto, blast] = await Promise.all([
      admin.from("text_automation_enrollments").select("id").eq("contact_id", contactId).not("last_step", "is", null).lte("enrolled_at", at).limit(1),
      admin.from("text_blast_recipients").select("id").eq("contact_id", contactId).eq("status", "sent").lte("sent_at", at).limit(1),
    ]);
    if (auto.error) throw auto.error;
    if (blast.error) throw blast.error;
    return !!(auto.data?.length || blast.data?.length);
  }
  const { data, error } = await admin.from("email_sequence_sends").select("id").eq("contact_id", contactId).lte("sent_at", at).limit(1);
  if (error) throw error;
  return !!data?.length;
}

export async function warmColdProspectOnReply(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  channel: "text" | "email",
  text: string | null,
  occurredAt: string,
): Promise<void> {
  try {
    if (!text || isNegative(channel, text)) return;

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .select("id, relationship_type, stage_id, archived, spam")
      .eq("id", contactId)
      .maybeSingle();
    if (contactError) throw contactError;
    if (!contact || contact.relationship_type !== "prospect" || contact.archived || contact.spam) return;

    const { data: stagesData } = await admin.from("pipeline_stages").select("*").eq("owner_id", ownerId);
    const stages = (stagesData ?? []) as PipelineStage[];
    const byName = (n: string) => stages.find((s) => s.name.trim().toLowerCase() === n);
    const cold = byName("cold");
    const warm = byName("warm");
    if (!cold || !warm || contact.stage_id !== cold.id) return;

    if (!(await gotCampaignBefore(admin, contactId, channel, occurredAt))) return;

    const { error } = await applyStageChange(admin, ownerId, contactId, cold, warm);
    if (error) {
      await reportFailure(`Couldn't move a Cold Prospect to Warm after their ${channel} reply`, error, { contactId });
      return;
    }
    await admin.from("activities").insert({
      owner_id: ownerId,
      contact_id: contactId,
      type: "status_change",
      direction: "none",
      source: "system",
      body: `Auto-moved from Cold to Warm (replied to a ${channel === "text" ? "text" : "email"} campaign)`,
    });
  } catch (err) {
    await reportFailure(`Couldn't check whether a ${channel} reply should move a Cold Prospect to Warm`, err, { contactId });
  }
}
