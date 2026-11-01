-- Relationship Type: one primary type per contact, independent of Stage.
-- Extra designations (e.g. a Client who also refers) go on tags. The old
-- contact_type column stays for internal logic but is no longer shown.
alter table public.contacts
  add column if not exists relationship_type text not null default 'community'
    check (relationship_type in ('community', 'prospect', 'client', 'referral_partner'));

-- When a contact first becomes a Client, and what they were before, for
-- conversion reporting (Prospect -> Client is client_converted_from =
-- 'prospect'). A trigger sets these so every path - the form, bulk edit,
-- import - is covered. Contacts created as Clients get no conversion date.
alter table public.contacts add column if not exists client_converted_at timestamptz;
alter table public.contacts add column if not exists client_converted_from text;

create or replace function public.track_client_conversion()
returns trigger as $$
begin
  if new.relationship_type = 'client'
     and old.relationship_type is distinct from 'client'
     and new.client_converted_at is null then
    new.client_converted_at := now();
    new.client_converted_from := old.relationship_type;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists contacts_track_client_conversion on public.contacts;
create trigger contacts_track_client_conversion
  before update of relationship_type on public.contacts
  for each row execute function public.track_client_conversion();

create index if not exists contacts_owner_relationship_type_idx on public.contacts(owner_id, relationship_type);

-- Stages: exactly Cold, Warm, Hot, Nurture. Every existing contact moves
-- to Nurture; their activity history is untouched (it lives in
-- activities, not on the stage). Old stages are then removed - contacts,
-- deals and AI suggestions that pointed at them are re-pointed or nulled
-- by the existing foreign keys, never deleted.
insert into public.pipeline_stages (owner_id, name, color, sort_order)
select o.owner_id, v.name, v.color, v.sort_order
from (select distinct owner_id from public.pipeline_stages) o
cross join (values
  ('Cold',    '#3b82f6', 0),
  ('Warm',    '#f59e0b', 1),
  ('Hot',     '#f97316', 2),
  ('Nurture', '#a855f7', 3)
) as v(name, color, sort_order)
where not exists (
  select 1 from public.pipeline_stages s where s.owner_id = o.owner_id and s.name = v.name
);

update public.contacts c
set stage_id = s.id
from public.pipeline_stages s
where s.owner_id = c.owner_id and s.name = 'Nurture';

delete from public.pipeline_stages where name not in ('Cold', 'Warm', 'Hot', 'Nurture');
