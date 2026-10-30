-- "Active leads" and the metrics dashboard both need to know which stages
-- are genuinely closed out (won or lost) vs still active. "Closed - Client"
-- already had is_closed_won set; "Past Client" is functionally the same
-- (a completed, positive relationship) but was left unflagged since it
-- predates this distinction mattering. Flip it now so it's excluded from
-- active-lead counts, same as "Closed - Client".
update public.pipeline_stages
set is_closed_won = true
where name = 'Past Client' and is_closed_won = false and is_closed_lost = false;

-- Lets the agent set a target per metric (speed to lead, contacted %,
-- follow-up rate, conversion rate) and see it against the actual number on
-- the dashboard.
create table public.metric_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null
    check (metric_key in ('speed_to_lead', 'contacted_pct', 'follow_up_rate', 'conversion_rate')),
  target_value numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, metric_key)
);

alter table public.metric_goals enable row level security;

create policy "owner full access" on public.metric_goals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create trigger metric_goals_set_updated_at
  before update on public.metric_goals
  for each row execute function public.set_updated_at();
