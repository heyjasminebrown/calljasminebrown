-- Web Push subscriptions - one row per browser/device that's enabled
-- notifications. endpoint is unique because a given browser install
-- always reuses the same PushManager subscription; re-enabling from the
-- same device should update the keys in place, not create a duplicate.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_owner_idx on public.push_subscriptions(owner_id);

alter table public.push_subscriptions enable row level security;

create policy "owner full access" on public.push_subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
