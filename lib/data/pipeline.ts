import { filterByQueue } from "@/lib/crm/contact-queue-filter";
import { getLastActivityLabels } from "@/lib/data/contacts";
import { listPendingDeals } from "@/lib/data/commissions";
import { createClient } from "@/lib/supabase/server";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

export type PipelinePendingDeal = { id: string; address: string | null; expectedClosingDate: string | null; netCommission: number };

export type PipelineExtras = {
  lastActivityLabels: Record<string, string>;
  coldFromHotIds: Record<string, true>;
  noContactIds: Record<string, true>;
  // A contact can genuinely have more than one deal under contract at
  // once (e.g. representing them as both buyer and seller) - every
  // pending deal is kept, not just the most recent, so Pipeline can show
  // each one instead of silently dropping all but one.
  pendingDealByContact: Record<string, PipelinePendingDeal[]>;
  // Latest status_change (or created_at if none) so cards can show
  // "12d in stage" without a per-row query. Records, not Maps, because
  // PipelineMobileRow is a client component and RSC cannot serialize Map.
  stageEnteredAt: Record<string, string>;
};

async function getStageEnteredAt(contacts: ContactWithRelations[]): Promise<Record<string, string>> {
  const entered: Record<string, string> = {};
  for (const contact of contacts) entered[contact.id] = contact.created_at;
  if (contacts.length === 0) return entered;

  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("contact_id, occurred_at")
    .in("contact_id", contacts.map((c) => c.id))
    .eq("type", "status_change")
    .order("occurred_at", { ascending: false });

  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (seen.has(row.contact_id)) continue;
    seen.add(row.contact_id);
    entered[row.contact_id] = row.occurred_at;
  }
  return entered;
}

// Batches everything the redesigned Pipeline's per-card context lines and
// per-stage summary numbers need, reusing queue predicates/helpers that
// already exist for Contacts filters and Insights instead of inventing
// new query logic. "projected" commission here is an estimate, not a
// promise - the original app ran this through a brokerage-specific cap
// formula (lib/crm/commission.ts), intentionally excluded from this
// chassis (see README); this just uses the deal's own gross_commission.
export async function getPipelineExtras(contacts: ContactWithRelations[], stages: PipelineStage[]): Promise<PipelineExtras> {
  const [lastActivityLabels, coldFromHot, noContact, pendingDeals, stageEnteredAt] = await Promise.all([
    getLastActivityLabels(contacts.map((c) => c.id)),
    filterByQueue(contacts, "cold_from_hot", stages),
    filterByQueue(contacts, "no_contact", stages),
    listPendingDeals(),
    getStageEnteredAt(contacts),
  ]);

  const pendingDealByContact: Record<string, PipelinePendingDeal[]> = {};
  for (const deal of pendingDeals) {
    if (!deal.contact_id) continue;
    const list = pendingDealByContact[deal.contact_id] ?? [];
    list.push({
      id: deal.id,
      address: deal.address,
      expectedClosingDate: deal.expected_closing_date,
      netCommission: deal.gross_commission ?? 0,
    });
    pendingDealByContact[deal.contact_id] = list;
  }

  return {
    lastActivityLabels: Object.fromEntries(lastActivityLabels),
    coldFromHotIds: Object.fromEntries(coldFromHot.map((c) => [c.id, true as const])),
    noContactIds: Object.fromEntries(noContact.map((c) => [c.id, true as const])),
    pendingDealByContact,
    stageEnteredAt,
  };
}
