-- Team logins: someone helping Jasmine signs in with their own email and
-- works in HER CRM (same contacts, messages, campaigns). She adds their
-- email under Settings -> Team.
--
-- How: every access rule used "owner_id = auth.uid()" (the signed-in
-- person's own rows). They now use crm_owner_id(): the CRM owner the
-- signed-in person works for - themselves, or Jasmine for a team member.
-- Only Jasmine can add or remove team members.

create table if not exists public.crm_team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(trim(email)) and email like '%@%'),
  created_at timestamptz not null default now()
);

alter table public.crm_team_members enable row level security;
grant select, insert, update, delete on public.crm_team_members to authenticated;
drop policy if exists "owner manages team" on public.crm_team_members;
create policy "owner manages team" on public.crm_team_members
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "member sees own membership" on public.crm_team_members;
create policy "member sees own membership" on public.crm_team_members
  for select using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.crm_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.owner_id from public.crm_team_members t
      where t.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      limit 1),
    auth.uid()
  );
$$;
grant execute on function public.crm_owner_id() to authenticated;

-- Rewrite every access rule in the public schema that checks auth.uid()
-- (except the team table's own rules above).
do $$
declare
  p record;
  q text;
  c text;
  stmt text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public'
      and tablename <> 'crm_team_members'
      and (coalesce(qual, '') like '%auth.uid()%' or coalesce(with_check, '') like '%auth.uid()%')
  loop
    q := replace(p.qual, 'auth.uid()', '(select public.crm_owner_id())');
    c := replace(p.with_check, 'auth.uid()', '(select public.crm_owner_id())');
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    stmt := format('create policy %I on %I.%I as %s for %s to %s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r), ', ') from unnest(p.roles) r));
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
    execute stmt;
  end loop;
end $$;

-- A team member's first sign-in creates their login; skip the starter
-- stages/tags meant for a brand-new CRM owner (they work in hers).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if exists (select 1 from public.crm_team_members t where t.email = lower(coalesce(new.email, ''))) then
    return new;
  end if;

  insert into public.pipeline_stages (owner_id, name, color, sort_order, is_closed_won, is_closed_lost, is_trash, is_under_contract) values
    (new.id, 'New Lead',        '#3b82f6', 0, false, false, false, false),
    (new.id, 'Contacted',       '#6366f1', 1, false, false, false, false),
    (new.id, 'Nurturing',       '#a855f7', 2, false, false, false, false),
    (new.id, 'Hot / Ready',     '#f97316', 3, false, false, false, false),
    (new.id, 'Under Contract',  '#f59e0b', 4, false, false, false, true),
    (new.id, 'Closed - Client', '#22c55e', 5, true,  false, false, false),
    (new.id, 'Past Client',     '#14b8a6', 6, true,  false, false, false),
    (new.id, 'Lost / Not Now',  '#94a3b8', 7, false, true,  false, false),
    (new.id, 'Trash',           '#d4d4d4', 8, false, false, true,  false);

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
