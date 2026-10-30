-- Conversion tracking needs to survive a contact cycling back to an active
-- stage after closing (repeat investors buying multiple properties a year)
-- - a contact's current stage can no longer be the source of truth for
-- "have they ever converted," since it only reflects where they are right
-- now. Deals are a permanent, append-only record instead: one row per
-- closed transaction, written when a contact's stage transitions into a
-- "Win" stage, and never touched again regardless of where they move next.
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index deals_contact_idx on public.deals(contact_id);
create index deals_owner_idx on public.deals(owner_id, closed_at desc);

alter table public.deals enable row level security;

create policy "owner full access" on public.deals
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A stage marked "Trash" means the contact isn't a real lead at all (spam,
-- wrong number, unrelated) - distinct from Closed (a real prospect who did
-- or didn't convert). Selecting a Trash stage for a contact archives them
-- immediately, reusing every existing "hide archived contacts" filter
-- throughout the app instead of needing a separate exclusion flag.
alter table public.pipeline_stages
  add column is_trash boolean not null default false;

-- Give future signups (via handle_new_user) a real Trash stage distinct
-- from "Lost / Not Now", matching this distinction going forward.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.pipeline_stages (owner_id, name, color, sort_order, is_closed_won, is_closed_lost, is_trash) values
    (new.id, 'New Lead',        '#3b82f6', 0, false, false, false),
    (new.id, 'Contacted',       '#6366f1', 1, false, false, false),
    (new.id, 'Nurturing',       '#a855f7', 2, false, false, false),
    (new.id, 'Hot / Ready',     '#f97316', 3, false, false, false),
    (new.id, 'Under Contract',  '#f59e0b', 4, false, false, false),
    (new.id, 'Closed - Client', '#22c55e', 5, true,  false, false),
    (new.id, 'Past Client',     '#14b8a6', 6, true,  false, false),
    (new.id, 'Lost / Not Now',  '#94a3b8', 7, false, true,  false),
    (new.id, 'Trash',           '#d4d4d4', 8, false, false, true);

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
