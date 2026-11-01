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
    steps: input.steps.map((s) => ({
      id: s.id,
      label: s.label,
      body: s.body.trim(),
      onReply: { next: s.onReply.next },
      onNoReply: s.onNoReply.next ? { next: s.onNoReply.next, days: s.onNoReply.days, time: s.onNoReply.time } : { next: null },
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
