-- One row per owner (single-owner app) storing which "warm right now"
-- push rules are on. Three of four default on per the design brief; the
-- fourth (every single open) defaults off since it would otherwise fire
-- constantly.
create table public.warm_notification_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  rule_triple_open boolean not null default true,
  rule_past_client_click boolean not null default true,
  rule_hot_twice boolean not null default true,
  rule_every_open boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.warm_notification_settings enable row level security;

create policy "owner full access" on public.warm_notification_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
