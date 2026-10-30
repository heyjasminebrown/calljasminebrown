-- Staggered text-reminder sends to everyone registered for a given event.
-- Deliberately its own thing, not folded into email_sequences - this is a
-- one-off manual trigger tied to a specific event registration list, not a
-- recurring/automated drip, and SMS carries a different (carrier-level,
-- not just inbox-provider-level) bulk-sending risk than email.

create table public.text_blasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  message text not null,
  status text not null default 'sending'
    check (status in ('sending', 'completed', 'canceled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index text_blasts_owner_idx on public.text_blasts(owner_id, created_at desc);

-- Recipients are snapshotted at creation time (not re-queried live) so a
-- blast already in progress doesn't silently pick up new registrations
-- that came in after it started.
create table public.text_blast_recipients (
  id uuid primary key default gen_random_uuid(),
  blast_id uuid not null references public.text_blasts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  error text
);

create index text_blast_recipients_blast_idx on public.text_blast_recipients(blast_id, status);

alter table public.text_blasts enable row level security;
alter table public.text_blast_recipients enable row level security;

create policy "owner full access" on public.text_blasts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access via blast" on public.text_blast_recipients
  for all using (exists (select 1 from public.text_blasts b where b.id = blast_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.text_blasts b where b.id = blast_id and b.owner_id = auth.uid()));
