-- Stop 5: a proposal can now log a showing (activities.type = 'showing',
-- already a valid value - see 0001_init.sql's check constraint and
-- ActivityTimeline's ICONS map), and the Notes inbox needs somewhere to
-- remember a manually-confirmed name match plus her matching-rule choices.
alter table public.proposed_changes drop constraint proposed_changes_field_check;
alter table public.proposed_changes add constraint proposed_changes_field_check check (field in (
  'budget', 'timeline', 'areas_of_interest', 'decision_maker', 'objection',
  'note', 'task', 'stage', 'showing'
));

create table public.granola_matching_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  match_on_calendar_event boolean not null default true,
  match_on_name_when_single boolean not null default true,
  ask_when_ambiguous boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.granola_matching_settings enable row level security;
create policy "owner full access" on public.granola_matching_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Once she confirms "That's her" for a name mentioned in an unmatched
-- note, the same name resolves automatically next time instead of asking
-- again - checked before the live per-contact substring search.
create table public.note_name_matches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name_text text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index note_name_matches_owner_name_idx on public.note_name_matches(owner_id, name_text);

alter table public.note_name_matches enable row level security;
create policy "owner full access" on public.note_name_matches
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
