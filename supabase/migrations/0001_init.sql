-- Lender CRM chassis — core schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- =========================================================
-- updated_at helper
-- =========================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================================================
-- pipeline_stages
-- =========================================================
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#94a3b8',
  sort_order integer not null default 0,
  is_closed_won boolean not null default false,
  is_closed_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create index pipeline_stages_owner_idx on public.pipeline_stages(owner_id, sort_order);

-- =========================================================
-- tags
-- =========================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#94a3b8',
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

-- =========================================================
-- contacts
-- =========================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,

  first_name text not null,
  last_name text default '',
  email text,
  phone text,
  secondary_phone text,

  contact_type text not null default 'buyer'
    check (contact_type in ('buyer', 'seller', 'both', 'investor', 'renter', 'referral_partner', 'vendor', 'past_client', 'sphere', 'other')),

  stage_id uuid references public.pipeline_stages(id) on delete set null,

  lead_source text,
  budget_min numeric,
  budget_max numeric,
  areas_of_interest text[] not null default '{}',

  timeline text default 'unknown'
    check (timeline in ('asap', '1_3_months', '3_6_months', '6_12_months', '12_plus_months', 'just_browsing', 'unknown')),

  next_follow_up_at timestamptz,
  birthday date,

  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,

  notes text,
  archived boolean not null default false,

  ai_last_status_note text,
  ai_last_analyzed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_owner_stage_idx on public.contacts(owner_id, stage_id);
create index contacts_owner_followup_idx on public.contacts(owner_id, next_follow_up_at);
create index contacts_owner_archived_idx on public.contacts(owner_id, archived);
create index contacts_search_idx on public.contacts using gin (
  to_tsvector('simple', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,''))
);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- =========================================================
-- contact_tags (join table)
-- =========================================================
create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- =========================================================
-- activities — unified timeline (calls, texts, emails, notes, meetings, showings, status changes)
-- =========================================================
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  type text not null
    check (type in ('call', 'text', 'email', 'note', 'meeting', 'showing', 'status_change', 'task_completed', 'system')),
  direction text not null default 'none'
    check (direction in ('inbound', 'outbound', 'none')),
  body text,
  occurred_at timestamptz not null default now(),

  source text not null default 'manual'
    check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'ai', 'system')),
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now()
);

create index activities_contact_idx on public.activities(contact_id, occurred_at desc);
create index activities_owner_idx on public.activities(owner_id, occurred_at desc);

-- =========================================================
-- tasks — follow-up reminders (contact-specific or general)
-- =========================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,

  title text not null,
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),

  created_at timestamptz not null default now()
);

create index tasks_owner_due_idx on public.tasks(owner_id, due_at) where completed_at is null;
create index tasks_contact_idx on public.tasks(contact_id);

-- =========================================================
-- important_dates — birthdays, closing anniversaries, etc.
-- =========================================================
create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  label text not null,
  date date not null,
  recurring boolean not null default true,

  created_at timestamptz not null default now()
);

create index important_dates_owner_idx on public.important_dates(owner_id, date);

-- =========================================================
-- ai_insights — generated summaries / suggested next actions per contact
-- =========================================================
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  summary text not null,
  suggested_action text,
  confidence numeric,
  dismissed boolean not null default false,

  created_at timestamptz not null default now()
);

create index ai_insights_contact_idx on public.ai_insights(contact_id, created_at desc);

-- =========================================================
-- Row Level Security — single-tenant-per-owner model
-- =========================================================
alter table public.pipeline_stages enable row level security;
alter table public.tags enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_tags enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.important_dates enable row level security;
alter table public.ai_insights enable row level security;

create policy "owner full access" on public.pipeline_stages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.tags
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.contacts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.activities
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.tasks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.important_dates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access" on public.ai_insights
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- contact_tags has no owner_id column; scope through the parent contact
create policy "owner full access via contact" on public.contact_tags
  for all
  using (exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid()));

-- =========================================================
-- Seed sensible defaults for every new auth user
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.pipeline_stages (owner_id, name, color, sort_order, is_closed_won, is_closed_lost) values
    (new.id, 'New Lead',        '#3b82f6', 0, false, false),
    (new.id, 'Contacted',       '#6366f1', 1, false, false),
    (new.id, 'Nurturing',       '#a855f7', 2, false, false),
    (new.id, 'Hot / Ready',     '#f97316', 3, false, false),
    (new.id, 'Under Contract',  '#f59e0b', 4, false, false),
    (new.id, 'Closed - Client', '#22c55e', 5, true,  false),
    (new.id, 'Past Client',     '#14b8a6', 6, false, false),
    (new.id, 'Lost / Not Now',  '#94a3b8', 7, false, true);

  insert into public.tags (owner_id, name, color) values
    (new.id, 'VIP', '#f97316'),
    (new.id, 'First-Time Buyer', '#3b82f6'),
    (new.id, 'Cash Buyer', '#22c55e'),
    (new.id, 'Investor', '#a855f7'),
    (new.id, 'Referral Partner', '#14b8a6'),
    (new.id, 'Meetup', '#ec4899'),
    (new.id, 'Sphere', '#6366f1');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
