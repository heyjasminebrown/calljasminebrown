-- Third Dialer queue: contacts to text/call to confirm attendance for an
-- event happening soon, either because they registered or because she
-- manually added them (interested but never registered). One row per
-- (event_id, contact_id) - source defaults to 'registered' so the
-- connect/snooze/dismiss actions (which don't know or care how someone
-- got on the list) can upsert without ever needing to pass it, while the
-- manual-add action sets it explicitly. See lib/data/dialer.ts's
-- listConfirmationQueue for how the "happening soon" window is computed.
create table public.event_confirmations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  event_name text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  source text not null default 'registered' check (source in ('registered', 'manual')),
  added_at timestamptz not null default now(),
  confirmed_at timestamptz,
  snoozed_at timestamptz,
  unique (event_id, contact_id)
);

alter table public.event_confirmations enable row level security;

create policy "owner full access" on public.event_confirmations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index event_confirmations_event_id_idx on public.event_confirmations(event_id);
create index event_confirmations_contact_id_idx on public.event_confirmations(contact_id);
