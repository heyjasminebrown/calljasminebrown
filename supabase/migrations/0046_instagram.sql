-- Phase 4 Stop 4: Instagram DMs. activities.contact_id is NOT NULL, so a
-- stranger's first message (no CRM match yet) can't live there the way a
-- Quo call/text can - same problem Granola's unmatched notes had, same
-- fix: a staging table with a nullable contact_id, mirrored into
-- activities once matched (immediately if remembered, manually
-- otherwise), so the contact's timeline is complete either way.
create table public.instagram_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  ig_sender_id text not null,
  ig_username text,
  ig_name text,
  ig_message_id text not null,
  text text not null default '',
  occurred_at timestamptz not null default now(),
  raw jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create unique index instagram_messages_dedupe_idx on public.instagram_messages(owner_id, ig_message_id);
create index instagram_messages_sender_idx on public.instagram_messages(owner_id, ig_sender_id, occurred_at desc);

alter table public.instagram_messages enable row level security;
create policy "owner full access" on public.instagram_messages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Manual match remembered permanently (not a 30-day dismiss like
-- everything else "remembered" in this app) - once she's confirmed
-- "@atl_renovator is Sarah", every future DM from that sender resolves
-- automatically, same idea as Granola's note_name_matches but keyed by
-- Instagram's page-scoped sender id instead of a name string.
create table public.instagram_contact_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  ig_sender_id text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index instagram_contact_links_owner_sender_idx on public.instagram_contact_links(owner_id, ig_sender_id);

alter table public.instagram_contact_links enable row level security;
create policy "owner full access" on public.instagram_contact_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'house_hacking_site', 'site_form', 'checkin', 'instagram', 'ai', 'system'));
