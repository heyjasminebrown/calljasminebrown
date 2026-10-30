-- Saved quick texts, for the mobile redesign's draft card / quick-text
-- chips / composer chips. One flat owner-ordered list, not a scope/tag
-- taxonomy - she's managing a handful of short templates, not a campaign
-- library. is_default_draft flags the one template Today's "Up next"
-- card pulls from automatically; the partial unique index keeps that to
-- at most one at a time (the UI unchecks the old one before writing the
-- new one, but the constraint is what actually guarantees it).
create table public.text_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  body text not null,
  is_default_draft boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index text_templates_owner_idx on public.text_templates(owner_id, sort_order);
create unique index text_templates_one_default_draft on public.text_templates(owner_id) where is_default_draft;

alter table public.text_templates enable row level security;
create policy "owner full access" on public.text_templates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
