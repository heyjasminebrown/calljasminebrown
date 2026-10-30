-- Saved contact lists ("show me all ASAP buyers tagged Hot") - just a
-- named, reusable filter combination. Stored as the same filter shape the
-- Contacts page already reads from its URL search params, so applying one
-- is just a navigation, no separate query logic needed.
create table public.contact_segments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  created_at timestamptz not null default now()
);

create index contact_segments_owner_idx on public.contact_segments(owner_id);

alter table public.contact_segments enable row level security;

create policy "owner full access" on public.contact_segments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
