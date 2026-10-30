-- Two fundamentally different trigger models, picked per sequence at
-- creation time:
--   'broadcast' - each step has a fixed send_at. Audience is re-evaluated
--     live at send time (whoever currently has target_tag_id), not locked
--     in when the sequence was created - a contact who gets the tag after
--     a step's date has passed just starts at the next upcoming step.
--   'drip' - each step has a delay (delay_amount/delay_unit) relative to
--     the contact's own enrolled_at, so two contacts who join a week apart
--     each get their own independent timing.
create table public.email_sequences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('broadcast', 'drip')),
  target_tag_id uuid references public.tags(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index email_sequences_owner_idx on public.email_sequences(owner_id);

create table public.email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_order int not null,
  subject text not null,
  body text not null,
  -- broadcast steps use send_at; drip steps use delay_amount/delay_unit
  -- (relative to the previous step, or to enrolled_at for the first step).
  -- Enforced in application code rather than a check constraint, since
  -- which pair applies depends on the parent sequence's type.
  send_at timestamptz,
  delay_amount int,
  delay_unit text check (delay_unit in ('hours', 'days')),
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create index email_sequence_steps_sequence_idx on public.email_sequence_steps(sequence_id, step_order);

-- Only meaningful for drip sequences - a broadcast step's audience is
-- computed live from tag membership, so there's no "position" to track.
create table public.email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  current_step int not null default 0,
  status text not null default 'active' check (status in ('active', 'completed')),
  unique (sequence_id, contact_id)
);

create index email_sequence_enrollments_due_idx on public.email_sequence_enrollments(sequence_id, status);

-- One row per (step, contact) send - doubles as the de-dup guard (a step
-- never sends twice to the same contact) and the tracking record for
-- opens/clicks, since both are keyed off a specific send, not the
-- sequence as a whole.
create table public.email_sequence_sends (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  step_id uuid not null references public.email_sequence_steps(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  open_count int not null default 0,
  clicked_at timestamptz,
  click_count int not null default 0,
  unsubscribed_at timestamptz,
  unique (step_id, contact_id)
);

create index email_sequence_sends_step_idx on public.email_sequence_sends(step_id);
create index email_sequence_sends_contact_idx on public.email_sequence_sends(contact_id);

-- Unsubscribe is per-sequence, not global - opting out of a monthly
-- newsletter drip shouldn't silently drop someone from event reminders
-- they explicitly want. Checked before every send, broadcast or drip.
create table public.email_sequence_exclusions (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.email_sequences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  excluded_at timestamptz not null default now(),
  unique (sequence_id, contact_id)
);

-- A stable, unguessable per-contact identifier for unsubscribe links -
-- separate from the contact's primary key so it can be safely exposed in
-- an email footer without leaking a real row id pattern.
alter table public.contacts add column unsubscribe_token uuid not null default gen_random_uuid() unique;

alter table public.email_sequences enable row level security;
alter table public.email_sequence_steps enable row level security;
alter table public.email_sequence_enrollments enable row level security;
alter table public.email_sequence_sends enable row level security;
alter table public.email_sequence_exclusions enable row level security;

create policy "owner full access" on public.email_sequences
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner full access via sequence" on public.email_sequence_steps
  for all
  using (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()));

create policy "owner full access via sequence" on public.email_sequence_enrollments
  for all
  using (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()));

create policy "owner full access via sequence" on public.email_sequence_sends
  for all
  using (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()));

create policy "owner full access via sequence" on public.email_sequence_exclusions
  for all
  using (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.owner_id = auth.uid()));

-- Auto-enroll into every active drip sequence targeting a tag the moment
-- that tag is added to a contact, regardless of which code path added it
-- (manual, webhook auto-tagging, engagement tagging, etc.) - a single
-- trigger here is the only way to guarantee that instead of hunting down
-- every insert site in the app.
create or replace function public.handle_new_contact_tag()
returns trigger as $$
begin
  insert into public.email_sequence_enrollments (sequence_id, contact_id)
  select s.id, new.contact_id
  from public.email_sequences s
  where s.type = 'drip' and s.active = true and s.target_tag_id = new.tag_id
  on conflict (sequence_id, contact_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_contact_tag_added
  after insert on public.contact_tags
  for each row execute function public.handle_new_contact_tag();

-- Symmetric behavior: removing the tag stops the drip. Only touches
-- enrollments still in progress - completed ones (and the sends already
-- recorded) are left alone as history.
create or replace function public.handle_removed_contact_tag()
returns trigger as $$
begin
  delete from public.email_sequence_enrollments e
  using public.email_sequences s
  where e.sequence_id = s.id
    and s.type = 'drip'
    and s.target_tag_id = old.tag_id
    and e.contact_id = old.contact_id
    and e.status = 'active';
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_contact_tag_removed
  after delete on public.contact_tags
  for each row execute function public.handle_removed_contact_tag();
