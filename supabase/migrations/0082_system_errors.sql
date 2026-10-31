-- Background failures (webhooks, cron jobs, integrations) that would
-- otherwise only reach Vercel's logs. Shown as a banner across the CRM
-- with the exact error until dismissed. A repeat of the same unresolved
-- error bumps `occurrences` instead of adding a row.
create table if not exists public.system_errors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  message text not null,
  details text,
  occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists system_errors_owner_open_idx
  on public.system_errors(owner_id, last_seen_at desc) where resolved_at is null;

alter table public.system_errors enable row level security;

create policy "owner full access" on public.system_errors
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
