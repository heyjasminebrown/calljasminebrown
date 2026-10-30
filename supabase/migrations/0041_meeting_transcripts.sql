-- Phase 3: every recorded conversation (Quo calls, Tactiq meetings, Granola
-- in-person notes, a voice memo) becomes a meeting_transcripts row plus a
-- set of individually-approvable proposed_changes rows, instead of the
-- single flat ai_insights row a call currently produces. ai_insights
-- keeps serving the lighter inbound-text nudge flow unchanged - this is a
-- new, parallel schema, not a replacement.
create table public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- null = an unmatched Granola note, surfaced in the Notes inbox instead
  -- of going straight to a contact's record.
  contact_id uuid references public.contacts(id) on delete set null,
  source text not null check (source in ('quo', 'tactiq', 'granola', 'memo')),
  external_id text not null,
  raw_payload jsonb not null,
  participants jsonb not null default '[]',
  duration_seconds integer,
  occurred_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'no_proposals', 'failed')),
  summary_bullets text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- The dedupe target for the exact "webhook fires twice" bug this phase is
-- explicitly meant not to repeat - same partial-unique-index-free shape as
-- activities.dedupe_field/dedupe_value (source+external_id is never null
-- here, so a plain unique index is enough, no partial index needed).
create unique index meeting_transcripts_dedupe_idx on public.meeting_transcripts(owner_id, source, external_id);
create index meeting_transcripts_contact_idx on public.meeting_transcripts(contact_id, status);

alter table public.meeting_transcripts enable row level security;
create policy "owner full access" on public.meeting_transcripts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table public.proposed_changes (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.meeting_transcripts(id) on delete cascade,
  field text not null check (field in (
    'budget', 'timeline', 'areas_of_interest', 'decision_maker', 'objection',
    'note', 'task', 'stage'
  )),
  -- Shape depends on field: {min, max} for budget, a plain string for
  -- note/decision_maker/objection, {name} appended for areas_of_interest,
  -- {title, dueAt} for task, {stageId, stageName} for stage.
  proposed_value jsonb not null,
  current_value jsonb,
  quote text not null,
  timestamp_seconds integer,
  speaker text,
  confidence numeric not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index proposed_changes_transcript_idx on public.proposed_changes(transcript_id, status);

alter table public.proposed_changes enable row level security;
-- No owner_id on this table (it hangs off meeting_transcripts, which is
-- already owner-scoped) - scope RLS through the parent instead.
create policy "owner full access" on public.proposed_changes
  for all using (
    exists (select 1 from public.meeting_transcripts t where t.id = transcript_id and t.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.meeting_transcripts t where t.id = transcript_id and t.owner_id = auth.uid())
  );

alter table public.contacts add column decision_maker text;
alter table public.contacts add column objection text;
