-- Idempotency claim for the prep-sheet cron, which polls every 5 minutes
-- for meetings starting in the next ~30 minutes - without this, the same
-- upcoming meeting would generate a new push/email/pinned card on every
-- poll that still falls inside the window, not just once.
create table public.prep_sheet_sends (
  event_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.prep_sheet_sends enable row level security;

create policy "owner full access" on public.prep_sheet_sends
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
