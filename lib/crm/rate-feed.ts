import type { SupabaseClient } from "@supabase/supabase-js";

export const RATE_PRODUCT = "30yr_fixed";

export async function recordDailyRate(
  admin: SupabaseClient,
  ownerId: string,
  ratePct: number,
  source: "fred" | "manual",
  rateDate?: string,
): Promise<void> {
  const date = rateDate ?? new Date().toISOString().slice(0, 10);
  await admin
    .from("daily_rates")
    .upsert(
      { owner_id: ownerId, rate_date: date, product: RATE_PRODUCT, rate_pct: ratePct, source },
      { onConflict: "owner_id,rate_date,product" },
    );
}

// FRED's PMMS series (Freddie Mac's 30-year fixed average) - a free,
// well-documented public API, gated behind FRED_API_KEY same as every
// other optional integration in this app (unset = this path just isn't
// used; the manual entry in Settings is the always-available fallback,
// same "API is a seed, her numbers are what matters" pattern the
// calculator's rent estimate already established). Not wired to run
// automatically unless FRED_API_KEY is set.
export async function fetchFredRate(apiKey: string): Promise<{ ratePct: number; date: string } | null> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.error("FRED rate fetch failed", err);
    return null;
  }
  if (!response.ok) {
    console.error("FRED rate fetch returned", response.status);
    return null;
  }

  const body = (await response.json()) as { observations?: { date: string; value: string }[] };
  const observation = body.observations?.[0];
  if (!observation) return null;

  const ratePct = Number(observation.value);
  if (!Number.isFinite(ratePct)) return null;

  return { ratePct, date: observation.date };
}
