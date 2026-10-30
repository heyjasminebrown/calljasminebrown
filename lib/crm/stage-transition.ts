import type { SupabaseClient } from "@supabase/supabase-js";
import type { Deal, PipelineStage } from "@/types/database";

export type DealModalMode = "under_contract" | "celebrate" | null;

export type PendingDealSummary = Pick<Deal, "id" | "address" | "client_name">;

// Central place to apply a contact's stage change so every entry point
// (manual selector, kanban card, AI-suggested apply) gets the same side
// effects: archiving on a move into Trash, capturing early deal details on
// a move into Under Contract, and finalizing/logging the permanent deals
// row on a move into a Win stage. A 'won' row is never touched again after
// being written, so a contact can cycle back to active and close again
// without losing the earlier conversion.
export async function applyStageChange(
  supabase: SupabaseClient,
  ownerId: string,
  contactId: string,
  oldStage: PipelineStage | undefined,
  newStage: PipelineStage | undefined,
  // Mobile's Stage & tags sheet lets her set the next follow-up in the
  // same action as the stage move ("Then follow up: Tomorrow/3 days/...")
  // - folded into this same patch so it's genuinely one write, not two.
  nextFollowUpAt?: string | null,
) {
  const patch: Record<string, unknown> = { stage_id: newStage?.id ?? null };
  if (newStage?.is_trash) patch.archived = true;
  if (nextFollowUpAt !== undefined) patch.next_follow_up_at = nextFollowUpAt;

  const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
  if (error) return { error, dealId: null, dealMode: null as DealModalMode, pendingAtRisk: null };

  // dealId+dealMode are only set when the caller should pop the deal
  // details modal. The underlying row exists (and 'won' rows count toward
  // conversion rate) regardless of whether the agent fills in the modal or
  // skips it - the modal is purely for the extra detail.
  let dealId: string | null = null;
  let dealMode: DealModalMode = null;
  let pendingAtRisk: PendingDealSummary[] | null = null;

  const enteringWon = newStage?.is_closed_won && !oldStage?.is_closed_won;
  const enteringUnderContract = newStage?.is_under_contract && !oldStage?.is_under_contract;

  if (enteringWon) {
    // Reuse a pending deal opened at Under Contract if one exists, so the
    // address/price/etc. already captured there survives instead of being
    // asked for twice - otherwise this is a fresh conversion. If a contact
    // has more than one pending deal at once, this grabs the most recent
    // one; get the wrong one and it's a quick fix via the edit (pencil)
    // icon's Status dropdown on either deal.
    const { data: pending } = await supabase
      .from("deals")
      .select("id")
      .eq("contact_id", contactId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending) {
      const { error: dealError } = await supabase
        .from("deals")
        .update({ status: "won", stage_id: newStage!.id, closed_at: new Date().toISOString() })
        .eq("id", pending.id);
      if (dealError) return { error: dealError, dealId: null, dealMode: null as DealModalMode, pendingAtRisk: null };
      dealId = pending.id;
    } else {
      const { data, error: dealError } = await supabase
        .from("deals")
        .insert({ owner_id: ownerId, contact_id: contactId, stage_id: newStage!.id, status: "won" })
        .select("id")
        .single();
      if (dealError) return { error: dealError, dealId: null, dealMode: null as DealModalMode, pendingAtRisk: null };
      dealId = data?.id ?? null;
    }
    dealMode = dealId ? "celebrate" : null;
  } else if (enteringUnderContract) {
    const { data, error: dealError } = await supabase
      .from("deals")
      .insert({ owner_id: ownerId, contact_id: contactId, stage_id: newStage!.id, status: "pending" })
      .select("id")
      .single();
    if (dealError) return { error: dealError, dealId: null, dealMode: null as DealModalMode, pendingAtRisk: null };
    dealId = data?.id ?? null;
    dealMode = dealId ? "under_contract" : null;
  } else if (oldStage?.is_under_contract && !newStage?.is_under_contract) {
    // Left an Under Contract stage without closing - never auto-delete,
    // since a contact can have more than one deal in flight at once (a
    // Buy/Sell client under contract on both sides) and there's no
    // reliable way to know which pending deal the stage change was
    // "about." Instead, surface every still-pending deal so the caller
    // can ask before removing anything.
    const { data: stillPending } = await supabase
      .from("deals")
      .select("id, address, client_name")
      .eq("contact_id", contactId)
      .eq("status", "pending");
    if (stillPending && stillPending.length > 0) pendingAtRisk = stillPending;
  }

  return { error: null, dealId, dealMode, pendingAtRisk };
}
