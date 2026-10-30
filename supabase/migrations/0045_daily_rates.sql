-- Phase 4 Stop 3: a daily mortgage rate feed, so week-over-week comparison
-- is a query. "Daily" here just means "one row per day it was recorded" -
-- the underlying source (Freddie Mac's PMMS, surfaced via FRED) actually
-- only updates weekly; a day with no real change simply doesn't get a new
-- distinct value, and rate-move detection compares against the last
-- DISTINCT value on file, not literally yesterday's row.
create table public.daily_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  rate_date date not null,
  product text not null default '30yr_fixed',
  rate_pct numeric not null,
  -- 'fred' (automatic, if FRED_API_KEY is configured) or 'manual' (typed
  -- into Settings) - manual always wins as the freshest entry for a given
  -- day if both happen to fire, since the cron upserts and a manual entry
  -- typed afterward would simply overwrite it for that date.
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create unique index daily_rates_owner_date_product_idx on public.daily_rates(owner_id, rate_date, product);

alter table public.daily_rates enable row level security;
create policy "owner full access" on public.daily_rates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
