import type { SupabaseClient } from "@supabase/supabase-js";
import { applyStageChange } from "@/lib/crm/stage-transition";
import type { PipelineStage } from "@/types/database";

const OUTREACH_TYPES = ["call", "text", "email"];

function findStage(stages: PipelineStage[], name: string): PipelineStage | undefined {
  return stages.find((s) => s.name.trim().toLowerCase() === name);
}

// Narrow, forward-only automation, per the default pipeline model: New Lead ->
// Contacted the moment anything's gone out with no reply yet, Contacted
// -> Nurturing once a real back-and-forth exists (both directions on
// file). Deliberately touches only contacts currently sitting in New
// Lead or Contacted - Hot/Ready is her call to make, never this
// algorithm's, and a contact already in Nurturing or anywhere else is
// left alone. Never moves a contact backward either - going quiet is
// already tracked separately (cold_from_hot/attended_gone_quiet), not by
// demoting stage, so a contact who stops replying just stays wherever
// they are until she moves them herself.
//
// One simplification worth flagging: an inbound-only contact (they
// texted her first and she hasn't replied yet) also counts as
// "Contacted" here, not just outbound-only - the moment any real
// communication trace exists, staying in New Lead (defined elsewhere as
// zero contact at all, see the no_contact queue) is wrong regardless of
// which direction started it. Nurturing still requires both directions.
export async function runAutoStage(admin: SupabaseClient, ownerId: string): Promise<{ moved: number }> {
  const { data: stagesData } = await admin.from("pipeline_stages").select("*").eq("owner_id", ownerId);
  const stages = (stagesData ?? []) as PipelineStage[];
  const newLeadStage = findStage(stages, "new lead");
  const contactedStage = findStage(stages, "contacted");
  const nurturingStage = findStage(stages, "nurturing");
  if (!contactedStage && !nurturingStage) return { moved: 0 };

  const candidateStageIds = [newLeadStage?.id, contactedStage?.id].filter((id): id is string => !!id);
  if (candidateStageIds.length === 0) return { moved: 0 };

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, stage_id")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .in("stage_id", candidateStageIds);
  if (!contacts || contacts.length === 0) return { moved: 0 };

  const contactIds = contacts.map((c) => c.id);
  const { data: activities } = await admin.from("activities").select("contact_id, direction").in("contact_id", contactIds).in("type", OUTREACH_TYPES);

  const hasOutbound = new Set<string>();
  const hasInbound = new Set<string>();
  for (const row of activities ?? []) {
    if (row.direction === "outbound") hasOutbound.add(row.contact_id as string);
    if (row.direction === "inbound") hasInbound.add(row.contact_id as string);
  }

  let moved = 0;
  for (const contact of contacts) {
    const outbound = hasOutbound.has(contact.id);
    const inbound = hasInbound.has(contact.id);
    if (!outbound && !inbound) continue; // genuinely still untouched - stays New Lead

    let target: PipelineStage | undefined;
    if (contact.stage_id === newLeadStage?.id) {
      target = outbound && inbound ? nurturingStage : contactedStage;
    } else if (contact.stage_id === contactedStage?.id) {
      target = outbound && inbound ? nurturingStage : undefined;
    }
    if (!target || target.id === contact.stage_id) continue;

    const oldStage = stages.find((s) => s.id === contact.stage_id);
    const { error } = await applyStageChange(admin, ownerId, contact.id, oldStage, target);
    if (error) continue;

    await admin.from("activities").insert({
      owner_id: ownerId,
      contact_id: contact.id,
      type: "status_change",
      direction: "none",
      source: "system",
      body: `Auto-moved from ${oldStage?.name ?? "None"} to ${target.name} (${outbound && inbound ? "started replying back" : "reached out, no reply yet"})`,
    });
    moved++;
  }

  return { moved };
}
