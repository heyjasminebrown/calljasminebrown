-- One connected Gmail account per owner (single-tenant app, but modeled
-- as owner-scoped like everything else for RLS consistency and in case
-- of a future re-connect/token rotation). history_id tracks where the
-- last sync left off, so polling only asks Gmail for what changed since
-- then instead of re-scanning the inbox every run.
create table public.gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  email_address text not null,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  last_history_id text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_accounts enable row level security;

create policy "owner full access" on public.gmail_accounts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger gmail_accounts_set_updated_at
  before update on public.gmail_accounts
  for each row execute function public.set_updated_at();
