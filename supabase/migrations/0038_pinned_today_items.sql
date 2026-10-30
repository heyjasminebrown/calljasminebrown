-- "Pinned until cleared" cards at the top of Today - the weekly review
-- (Sunday 5pm) and the prep sheet (30 minutes before a calendar event)
-- both write one row here and stay pinned until a person clears them (or,
-- for the prep sheet, the meeting time passes). payload carries
-- everything the card needs to render so Today doesn't have to
-- re-derive a week-old snapshot from current data.
create table public.pinned_today_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('weekly_review', 'prep_sheet')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create index pinned_today_items_owner_idx on public.pinned_today_items(owner_id, kind, cleared_at);

alter table public.pinned_today_items enable row level security;

create policy "owner full access" on public.pinned_today_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
