-- Real audience targeting for sequence/batch emails, replacing the single
-- target_tag_id with "any of these tags" plus exclude filters - she asked
-- directly for multiple include tags and excludes by tag/stage/timeline.
-- Existing single-tag sequences migrate straight into the new array
-- column before the old one is dropped.
alter table public.email_sequences add column target_tag_ids uuid[] not null default '{}';
update public.email_sequences set target_tag_ids = array[target_tag_id] where target_tag_id is not null;

alter table public.email_sequences add column exclude_tag_ids uuid[] not null default '{}';
alter table public.email_sequences add column exclude_stage_ids uuid[] not null default '{}';
alter table public.email_sequences add column exclude_timelines text[] not null default '{}';

-- Drip auto-enroll/un-enroll triggers matched against the old single
-- column - repoint them at the new array (any() membership) before it's
-- dropped, or adding a tag to a drip sequence would silently stop
-- enrolling anyone.
create or replace function public.handle_new_contact_tag()
returns trigger as $$
begin
  insert into public.email_sequence_enrollments (sequence_id, contact_id)
  select s.id, new.contact_id
  from public.email_sequences s
  where s.type = 'drip' and s.active = true and new.tag_id = any(s.target_tag_ids)
  on conflict (sequence_id, contact_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.handle_removed_contact_tag()
returns trigger as $$
begin
  delete from public.email_sequence_enrollments e
  using public.email_sequences s
  where e.sequence_id = s.id
    and s.type = 'drip'
    and old.tag_id = any(s.target_tag_ids)
    and e.contact_id = old.contact_id
    and e.status = 'active';
  return old;
end;
$$ language plpgsql security definer set search_path = public;

alter table public.email_sequences drop column target_tag_id;
