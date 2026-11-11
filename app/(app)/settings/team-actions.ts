"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isTeamMember } from "@/lib/supabase/team-identity";

type Result = { ok: true } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only the CRM owner manages the team (the database enforces this too).
async function ownerClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ownerId: null, error: "Your session expired - sign in again." };
  if (isTeamMember(user)) return { supabase, ownerId: null, error: "Only the CRM owner can change the team." };
  return { supabase, ownerId: user.id, error: null };
}

export async function addTeamMember(emailInput: string): Promise<Result> {
  const email = emailInput.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, error: "That email doesn't look right." };
  const { supabase, ownerId, error } = await ownerClient();
  if (!ownerId) return { ok: false, error: error! };
  if (email === (await supabase.auth.getUser()).data.user?.email?.toLowerCase()) return { ok: false, error: "That's your own email." };
  const { error: insertError } = await supabase.from("crm_team_members").insert({ owner_id: ownerId, email });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, error: "That email is already on the team." };
    return { ok: false, error: `Couldn't add them: ${insertError.message}` };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeTeamMember(id: string): Promise<Result> {
  const { supabase, ownerId, error } = await ownerClient();
  if (!ownerId) return { ok: false, error: error! };
  const { error: deleteError } = await supabase.from("crm_team_members").delete().eq("id", id);
  if (deleteError) return { ok: false, error: `Couldn't remove them: ${deleteError.message}` };
  revalidatePath("/settings");
  return { ok: true };
}
