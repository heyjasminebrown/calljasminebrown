-- A transaction's address/price/side are usually known well before it
-- actually closes - "Under Contract" is the natural point to capture them,
-- not the eventual close date. Any active stage can now be flagged as the
-- under-contract point (independent of Active/Closed/Trash, since a
-- contact under contract is still "active" until it either closes or
-- falls through).
alter table public.pipeline_stages
  add column is_under_contract boolean not null default false;

update public.pipeline_stages set is_under_contract = true where lower(name) = 'under contract';

-- A deal now has a lifecycle: 'pending' the moment a contact enters an
-- Under Contract stage (captured early, doesn't count as a real
-- conversion yet), promoted to 'won' if/when they later enter a Win
-- stage (same row, reused rather than duplicated), or deleted outright
-- if the contract falls through before closing. Existing rows predate
-- this concept and were all real closes, hence the 'won' default.
alter table public.deals
  add column status text not null default 'won' check (status in ('pending', 'won'));

create or replace function public.handle_new_user()
returns trigger as $$
begin
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
