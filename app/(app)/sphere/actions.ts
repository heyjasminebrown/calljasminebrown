"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmailToContact, sendTextToContact } from "@/app/(app)/contacts/actions";
import { writeDismissal } from "@/lib/crm/dismissed-insights";

// Sphere never batch-sends or auto-sends - every send here is a single
// contact, a single message, and only fires because a person clicked
// Send on that specific row. See the Phase 2 plan's Sphere section: "Only
// ever suggestions... nobody is asked for a review unless you press send
// on that person."
export async function sendSphereMessage(contactId: string, channel: "email" | "text", to: string, message: string) {
  const result =
    channel === "email" ? await sendEmailToContact(contactId, to, "Following up", message) : await sendTextToContact(contactId, to, message);
  revalidatePath("/sphere");
  return result;
}

async function dismiss(key: string, contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const result = await writeDismissal(supabase, user.id, key, contactId);
  if (!result.ok) return result;
  revalidatePath("/sphere");
  return { ok: true as const };
}

export async function sendReviewRequest(dealId: string, contactId: string, channel: "email" | "text", to: string, message: string) {
  const result = await sendSphereMessage(contactId, channel, to, message);
  if (result.ok) await dismiss(`review_dismissed:${dealId}`, contactId);
  return result;
}

export async function snoozeReviewRequest(dealId: string, contactId: string) {
  return dismiss(`review_snoozed:${dealId}`, contactId);
}

export async function dismissReviewRequest(dealId: string, contactId: string) {
  return dismiss(`review_dismissed:${dealId}`, contactId);
}
