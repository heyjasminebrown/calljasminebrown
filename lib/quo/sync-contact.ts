// Pushes a CRM contact's name + number into Quo, so calls and texts
// through Quo show a name instead of a raw number. A sync failure should
// never block a contact save, so every caller treats the result as
// informational.

import type { SupabaseClient } from "@supabase/supabase-js";
import { quoFetch } from "@/lib/quo/client";

const QUO_SOURCE = "crm";

type SyncableContact = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  // The Quo contact ID this CRM contact was last created as, if known.
  quo_contact_id?: string | null;
};

// Never searches Quo for "the matching contact" - that search (filtering
// by externalIds[]/sources[] query params) was never confirmed to actually
// work against a real Quo response, and in practice Quo appears to ignore
// those filters entirely: the lookup was returning an unrelated contact,
// and the PATCH that followed silently overwrote a real person's name and
// number with whoever synced next (confirmed 2026-08 - Kelly Lawrence's
// Quo contact got overwritten with Keisha Henderson's info this way).
// Instead: PATCH the exact quo_contact_id we already stored from this
// contact's own prior create, or POST a brand-new Quo contact and store
// the ID it hands back - never guess which existing Quo contact is "them".
export async function syncContactToQuo(
  admin: SupabaseClient,
  contact: SyncableContact,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!contact.phone) return { ok: true, skipped: true };

  try {
    const payload = {
      defaultFields: {
        firstName: contact.first_name || undefined,
        lastName: contact.last_name || undefined,
        emails: contact.email ? [{ name: "Email", value: contact.email }] : [],
        phoneNumbers: [{ name: "Mobile", value: contact.phone }],
      },
      source: QUO_SOURCE,
      externalId: contact.id,
    };

    if (contact.quo_contact_id) {
      const res = await quoFetch(`/contacts/${contact.quo_contact_id}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (!res.ok) {
        return { ok: false, error: `Quo contact sync failed (${res.status}): ${await res.text()}` };
      }
      await admin.from("contacts").update({ quo_synced_at: new Date().toISOString() }).eq("id", contact.id);
      return { ok: true };
    }

    const res = await quoFetch(`/contacts`, { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) {
      return { ok: false, error: `Quo contact sync failed (${res.status}): ${await res.text()}` };
    }
    // Response shape (a `{ data: { id } }` envelope, matching the list
    // endpoint's `{ data: [...] }` convention) isn't confirmed against a
    // real Quo response yet. If quo_contact_id keeps saving as null, check
    // a real POST /contacts response body and adjust this line - a null
    // here just means the next sync creates another new Quo contact
    // instead of updating this one, never that it overwrites someone else.
    const created = await res.json();
    const newQuoId = created?.data?.id ?? null;
    await admin
      .from("contacts")
      .update({ quo_synced_at: new Date().toISOString(), quo_contact_id: newQuoId })
      .eq("id", contact.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
