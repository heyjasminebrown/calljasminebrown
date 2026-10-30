-- Phase 2 redesign: referral tracking, renter lease-end reminders, the
-- "I know them personally" flag, and a 30-day dismissal record for the
-- new Insights page.

alter table public.contacts add column referred_by uuid references public.contacts(id) on delete set null;
alter table public.contacts add column lease_ends_at date;

-- Cross-cutting: any contact carrying this flag is skipped by every
-- automated suggestion or draft in every phase (Insights cards, Sphere's
-- review-request suggestions, the dialer's new-registrations queue, the
-- weekly review's suggested-calls list, ai_insights generation). See the
-- Phase 2 plan for the full touch-list this filters.
alter table public.contacts add column known_personally boolean not null default false;

-- One row per (owner, insight, contact) dismissal. insight_key encodes the
-- specific fact an Insights card is about (e.g.
-- "lease_reminder:<contact_id>:<lease_ends_at>") so a changed underlying
-- fact produces a new key and the dismissal simply stops matching -
-- surfacing the card again without any extra bookkeeping. contact_id is
-- nullable for a card-level dismissal (e.g. dismissing the whole
-- duplicates card rather than one pair).
create table public.dismissed_insights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  insight_key text not null,
  contact_id uuid references public.contacts(id) on delete cascade,
  dismissed_at timestamptz not null default now()
);

-- Two partial unique indexes rather than one plain unique constraint,
-- since Postgres treats every NULL as distinct in a unique constraint - a
-- plain (owner_id, insight_key, contact_id) unique would let card-level
-- dismissals (contact_id null) pile up duplicate rows instead of upserting.
create unique index dismissed_insights_contact_key on public.dismissed_insights(owner_id, insight_key, contact_id) where contact_id is not null;
create unique index dismissed_insights_card_key on public.dismissed_insights(owner_id, insight_key) where contact_id is null;

alter table public.dismissed_insights enable row level security;

create policy "owner full access" on public.dismissed_insights
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
