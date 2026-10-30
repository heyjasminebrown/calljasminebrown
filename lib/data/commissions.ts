import { createClient } from "@/lib/supabase/server";
import type { Deal } from "@/types/database";

// Generic "deal" list helpers shared by Pipeline, Insights, and Sphere.
// The original app also had a brokerage-specific commission/cap
// computation (lib/crm/commission.ts) and a listings-specific helper
// here - both intentionally excluded from this chassis (see README).
// These two plain status queries are left in place since several core
// chassis features depend on "which deals are won/pending" generically.

export type DealWithContact = Deal & {
  contacts: { id: string; first_name: string; last_name: string; lead_source: string | null } | null;
};

export async function listWonDeals(): Promise<DealWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, contacts(id, first_name, last_name, lead_source)")
    .eq("status", "won")
    .order("closed_at", { ascending: true });
  return (data ?? []) as DealWithContact[];
}

export async function listPendingDeals(): Promise<DealWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*, contacts(id, first_name, last_name, lead_source)")
    .eq("status", "pending")
    .order("closed_at", { ascending: true });
  return (data ?? []) as DealWithContact[];
}
