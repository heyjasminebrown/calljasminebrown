"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateCampaign, type CampaignInput } from "@/lib/crm/text-campaign-rules";

type Result = { ok: true; id: string } | { ok: false; error: string };

export async function saveTextCampaign(input: CampaignInput): Promise<Result> {
  const problem = validateCampaign(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const row = {
    name: input.name.trim(),
    trigger_type: input.triggerType,
    trigger_value: input.triggerValue.trim(),
    skip_campaign_ids: input.skipCampaignIds.filter((id) => id !== input.id),
    skip_tag_ids: [...new Set(input.skipTagIds)],
    steps: input.steps.map((s) => ({
      id: s.id,
      label: s.label,
      body: s.body.trim(),
      onReply: { next: s.onReply.next },
      onNoReply: s.onNoReply.next
        ? s.onNoReply.days === 0
          ? { next: s.onNoReply.next, days: 0 }
          : { next: s.onNoReply.next, days: s.onNoReply.days, time: s.onNoReply.time }
        : { next: null },
    })),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = input.id
    ? await supabase.from("text_campaigns").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("text_campaigns").insert({ ...row, owner_id: user.id, active: false }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save the campaign" };

  revalidatePath("/sequences");
  return { ok: true, id: data.id };
}

export async function setTextCampaignActive(id: string, active: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("text_campaigns").update({ active, updated_at: new Date().toISOString() }).eq("id", id).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't update the campaign" };
  revalidatePath("/sequences");
  return { ok: true, id };
}

// Deleting removes its in-progress contacts too (they simply get no more
// texts); texts already sent stay on their timelines.
export async function deleteTextCampaign(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("text_campaigns").delete().eq("id", id).select("id");
  if (error || !data?.length) return { ok: false, error: error?.message ?? "Nothing was deleted" };
  revalidatePath("/sequences");
  return { ok: true, id };
}

type Matching = { ok: true; contactIds: string[] } | { ok: false; error: string };

// Everyone who already matches a campaign's trigger and could be texted
// (has a phone, not opted out, archived or spam), minus anyone who has
// already been through it.
async function existingMatches(campaignId: string): Promise<Matching> {
  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from("text_campaigns")
    .select("id, trigger_type, trigger_value, skip_campaign_ids, skip_tag_ids")
    .eq("id", campaignId)
    .single();
  if (error || !c) return { ok: false, error: error?.message ?? "Campaign not found" };

  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    // A tag campaign joins on contact_tags; the others filter contacts directly.
    const columns: string = c.trigger_type === "tag" ? "id, contact_tags!inner(tag_id)" : "id";
    let q = supabase.from("contacts").select(columns).eq("archived", false).eq("spam", false).is("opted_out_at", null).not("phone", "is", null);
    if (c.trigger_type === "tag") q = q.eq("contact_tags.tag_id", c.trigger_value);
    if (c.trigger_type === "type") q = q.eq("relationship_type", c.trigger_value);
    if (c.trigger_type === "stage") q = q.eq("stage_id", c.trigger_value);
    if (c.trigger_type === "source") q = q.ilike("lead_source", c.trigger_value.trim());
    const { data, error: e } = await q.order("id").range(from, from + 999);
    if (e) return { ok: false, error: e.message };
    ids.push(...((data ?? []) as unknown as { id: string }[]).map((r) => r.id));
    if (!data || data.length < 1000) break;
  }

  const { data: already, error: e2 } = await supabase
    .from("text_automation_enrollments")
    .select("contact_id")
    .in("campaign_id", [campaignId, ...((c.skip_campaign_ids as string[] | null) ?? [])]);
  if (e2) return { ok: false, error: e2.message };
  const done = new Set((already ?? []).map((r) => r.contact_id as string));
  // Anyone with a skipped tag.
  const skipTags = (c.skip_tag_ids as string[] | null) ?? [];
  if (skipTags.length > 0) {
    for (let from = 0; ; from += 1000) {
      const { data: tagged, error: e3 } = await supabase.from("contact_tags").select("contact_id").in("tag_id", skipTags).range(from, from + 999);
      if (e3) return { ok: false, error: e3.message };
      for (const r of tagged ?? []) done.add(r.contact_id as string);
      if (!tagged || tagged.length < 1000) break;
    }
  }
  return { ok: true, contactIds: ids.filter((id) => !done.has(id)) };
}

export async function countExistingMatches(campaignId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const result = await existingMatches(campaignId);
  return result.ok ? { ok: true, count: result.contactIds.length } : result;
}

// Starts the campaign for everyone who already matches. Sends still go out
// a couple a minute, inside 9 AM-8 PM ET.
export async function enrollExistingMatches(campaignId: string): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: c, error } = await supabase.from("text_campaigns").select("id, active, steps").eq("id", campaignId).single();
  if (error || !c) return { ok: false, error: error?.message ?? "Campaign not found" };
  const firstStep = (c.steps as { id: string }[])[0]?.id;
  if (!firstStep) return { ok: false, error: "The campaign has no texts yet." };

  const matches = await existingMatches(campaignId);
  if (!matches.ok) return matches;
  if (matches.contactIds.length === 0) return { ok: true, added: 0 };

  const now = new Date().toISOString();
  for (let i = 0; i < matches.contactIds.length; i += 500) {
    const rows = matches.contactIds.slice(i, i + 500).map((contact_id) => ({
      owner_id: user.id,
      contact_id,
      campaign_id: campaignId,
      campaign: campaignId,
      next_step: firstStep,
      next_send_at: now,
    }));
    const { error: e } = await supabase.from("text_automation_enrollments").upsert(rows, { onConflict: "contact_id,campaign", ignoreDuplicates: true });
    if (e) return { ok: false, error: e.message };
  }
  revalidatePath("/sequences");
  return { ok: true, added: matches.contactIds.length };
}
