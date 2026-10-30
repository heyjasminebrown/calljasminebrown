import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateContact, addTagByName } from "@/lib/crm/find-or-create-contact";
import { upsertActivity } from "@/lib/crm/activities";
import { notifyNewLead } from "@/lib/push/send-push";

// An accidental double-share (tapped share twice, or the same card
// scanned again a moment later) generates a genuinely new dedupeId each
// time (a fresh blinq_contact_id from Zapier, or a fresh Gmail message
// id from the email path) - upsertActivity's own dedupe on that id never
// catches it. This is the real guard: within this window, a second share
// from the same person just enriches/re-tags the contact (both already
// idempotent) without logging a second "shared a card" note or a second
// push.
const DUPLICATE_SHARE_WINDOW_MINUTES = 10;

// Shared by both ways a Blinq share can reach this CRM: the Zapier
// webhook (Blinq Business only) and parsing Blinq's own free-tier "X has
// sent you their details" notification email straight out of the Gmail
// sync (lib/google/parse-blinq-email.ts) - same downstream effect either
// way, just a different trigger.
export async function recordBlinqContact(
  admin: SupabaseClient,
  ownerId: string,
  input: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company?: string | null;
    jobTitle?: string | null;
    dedupeId: string | null;
  },
): Promise<void> {
  if (!input.email && !input.phone) return;

  const contact = await findOrCreateContact(admin, ownerId, {
    email: input.email,
    phone: input.phone,
    firstName: input.firstName,
    lastName: input.lastName,
    leadSource: "Blinq",
  });
  if (!contact) return;

  await addTagByName(admin, ownerId, contact.id, "Blinq");

  const since = new Date(Date.now() - DUPLICATE_SHARE_WINDOW_MINUTES * 60_000).toISOString();
  const { data: recentShare } = await admin
    .from("activities")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("contact_id", contact.id)
    .eq("source", "blinq")
    .gte("occurred_at", since)
    .limit(1);
  const isDuplicateShare = (recentShare?.length ?? 0) > 0;

  if (!isDuplicateShare) {
    const details = [input.company, input.jobTitle].filter(Boolean).join(" · ");
    await upsertActivity(admin, ownerId, contact.id, "blinq", "blinq_contact_id", input.dedupeId, {
      type: "note",
      direction: "none",
      occurred_at: new Date().toISOString(),
      body: details ? `Shared a Blinq digital business card - ${details}` : "Shared a Blinq digital business card",
      metadata: { company: input.company ?? null, job_title: input.jobTitle ?? null },
    });
  }

  if (contact.wasCreated) {
    await notifyNewLead(admin, ownerId, {
      title: "New contact via Blinq",
      body: `${input.firstName ?? input.email ?? input.phone} shared their digital business card`,
      url: `/contacts/${contact.id}`,
    });
  }
}
