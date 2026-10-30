import type { SupabaseClient } from "@supabase/supabase-js";
import { sendQuoText } from "@/lib/quo/send-message";
import { applyMergeFields, hasPlaceholderName, usesFirstNameMergeField } from "@/lib/crm/merge-fields";
import { upsertActivity } from "@/lib/crm/activities";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { TEXT_BLAST_SENDS_PER_RUN, isWithinQuietHours } from "@/lib/crm/text-blast-timing";
import type { TextBlast } from "@/types/database";

export type TextBlastWithProgress = TextBlast & { total: number; sent: number; failed: number; skipped: number; pending: number };

// Prefixed label rather than a schema change to event_name (kept not-null
// for every existing event-based blast/query) - free-text, but distinctive
// enough it'll never collide with a real Eventbrite event title. Pure
// string logic in a plain module (not the "use server" actions file) so
// both the server action that creates the blast and the client modal that
// displays its label can call it directly, without a server round trip.
export function tagBlastLabel(tagName: string): string {
  return `Tag: ${tagName}`;
}

// Shared by the blast modal's "previous sends for this event" list and the
// Dashboard's "in progress" card, so the two views of the same numbers
// can't disagree with each other.
export function withProgress(blasts: TextBlast[], recipients: { blast_id: string; status: string }[]): TextBlastWithProgress[] {
  return blasts.map((b) => {
    const rows = recipients.filter((r) => r.blast_id === b.id);
    return {
      ...b,
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      failed: rows.filter((r) => r.status === "failed").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
      pending: rows.filter((r) => r.status === "pending").length,
    };
  });
}

// Same spacing rationale as lib/crm/sequences.ts (see its comment) - a
// burst of near-identical texts from one number in a tight loop is exactly
// the kind of traffic that gets a business SMS number flagged by carriers,
// so this caps how many actually send per cron tick and puts real jittered
// delay between them rather than firing the whole recipient list at once.
const MAX_SENDS_PER_RUN = TEXT_BLAST_SENDS_PER_RUN;
const MIN_SEND_SPACING_MS = 2500;
const SEND_SPACING_JITTER_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spaceSends() {
  await sleep(MIN_SEND_SPACING_MS + Math.floor(Math.random() * SEND_SPACING_JITTER_MS));
}

type PendingRecipient = {
  id: string;
  contact_id: string;
  contacts: { id: string; first_name: string; last_name: string; phone: string | null; email: string | null } | null;
};

export async function processPendingTextBlasts(admin: SupabaseClient, ownerId: string) {
  const { data: blasts } = await admin
    .from("text_blasts")
    .select("id, message, send_immediately")
    .eq("owner_id", ownerId)
    .eq("status", "sending")
    .order("created_at", { ascending: true });

  const quietHours = isWithinQuietHours();
  let remaining = MAX_SENDS_PER_RUN;

  for (const blast of blasts ?? []) {
    if (remaining <= 0) break;
    if (quietHours && !blast.send_immediately) continue;

    const { data: pending } = await admin
      .from("text_blast_recipients")
      .select("id, contact_id, contacts(id, first_name, last_name, phone, email)")
      .eq("blast_id", blast.id)
      .eq("status", "pending")
      .limit(remaining);

    const greetsBy = usesFirstNameMergeField(blast.message);

    for (const recipient of (pending ?? []) as unknown as PendingRecipient[]) {
      const contact = recipient.contacts;

      if (!contact?.phone) {
        await admin.from("text_blast_recipients").update({ status: "skipped", error: "No phone number" }).eq("id", recipient.id);
        continue;
      }

      // A contact created from a bare phone number (or email) with no name
      // ever collected has first_name literally set to that phone/email as
      // a placeholder - sending "Hi {{first_name}}" as-is would read as
      // "Hi 5739992048." Only matters when the message actually greets by
      // name; skipped (not sent with a blank/awkward substitute) so she can
      // follow up with them by hand instead.
      if (greetsBy && hasPlaceholderName(contact)) {
        await admin.from("text_blast_recipients").update({ status: "skipped", error: "No name on file" }).eq("id", recipient.id);
        continue;
      }

      const body = applyMergeFields(blast.message, contact);
      const result = await sendQuoText(contact.phone, body);

      if (result.ok) {
        await admin.from("text_blast_recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", recipient.id);
        await upsertActivity(admin, ownerId, contact.id, "quo", "quo_message_id", result.quoMessageId, {
          type: "text",
          direction: "outbound",
          occurred_at: new Date().toISOString(),
          body,
          metadata: { quo_message_id: result.quoMessageId, sent_from_crm: true, text_blast_id: blast.id },
        });
        await updateEngagementTag(admin, ownerId, contact.id);
      } else {
        await admin.from("text_blast_recipients").update({ status: "failed", error: result.error }).eq("id", recipient.id);
      }

      remaining--;
      if (remaining > 0) await spaceSends();
      if (remaining <= 0) break;
    }

    const { count: pendingCount } = await admin
      .from("text_blast_recipients")
      .select("id", { count: "exact", head: true })
      .eq("blast_id", blast.id)
      .eq("status", "pending");

    if ((pendingCount ?? 0) === 0) {
      await admin.from("text_blasts").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", blast.id);
    }
  }
}
