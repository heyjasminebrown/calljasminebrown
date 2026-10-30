-- A second, independent dialer queue: post-event follow-up calls. Separate
-- from dialer_contacted_at/dialer_snoozed_at (the registration-call
-- tracking) on purpose - someone can and should get both calls (one at
-- registration, one after they actually attend), so the two need
-- independent "have I called about this yet" state, not a single shared
-- flag that would make the second call impossible to track.
alter table public.contacts add column event_followup_contacted_at timestamptz;
alter table public.contacts add column event_followup_snoozed_at timestamptz;

create index contacts_event_followup_idx on public.contacts(owner_id, event_followup_contacted_at) where archived = false;

-- Extend merge_contacts (0021) to fold in the two new columns too, same
-- "more recently touched wins" pattern already used for dialer_contacted_at
-- /dialer_snoozed_at - a merged-away duplicate's follow-up state shouldn't
-- be silently lost.
create or replace function public.merge_contacts(keep_id uuid, merge_id uuid, actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if keep_id = merge_id then
    raise exception 'Cannot merge a contact into itself';
  end if;

  perform 1 from public.contacts where id = keep_id and owner_id = actor_id;
  if not found then
    raise exception 'Contact % not found for this owner', keep_id;
  end if;
  perform 1 from public.contacts where id = merge_id and owner_id = actor_id;
  if not found then
    raise exception 'Contact % not found for this owner', merge_id;
  end if;

  update public.contacts k
  set
    email = coalesce(k.email, m.email),
    phone = coalesce(k.phone, m.phone),
    secondary_phone = coalesce(k.secondary_phone, nullif(m.phone, k.phone), nullif(m.secondary_phone, k.phone)),
    contact_type = coalesce(k.contact_type, m.contact_type),
    representing = coalesce(k.representing, m.representing),
    listing_address = coalesce(k.listing_address, m.listing_address),
    listing_timeline = coalesce(k.listing_timeline, m.listing_timeline),
    stage_id = coalesce(k.stage_id, m.stage_id),
    lead_source = coalesce(k.lead_source, m.lead_source),
    budget_min = coalesce(k.budget_min, m.budget_min),
    budget_max = coalesce(k.budget_max, m.budget_max),
    areas_of_interest = (select array(select distinct unnest(k.areas_of_interest || m.areas_of_interest))),
    timeline = case when k.timeline = 'unknown' then m.timeline else k.timeline end,
    next_follow_up_at = least(k.next_follow_up_at, m.next_follow_up_at),
    birthday = coalesce(k.birthday, m.birthday),
    address_line1 = coalesce(k.address_line1, m.address_line1),
    address_line2 = coalesce(k.address_line2, m.address_line2),
    city = coalesce(k.city, m.city),
    state = coalesce(k.state, m.state),
    postal_code = coalesce(k.postal_code, m.postal_code),
    last_event_name = case when m.last_event_at is not null and (k.last_event_at is null or m.last_event_at > k.last_event_at)
                        then m.last_event_name else k.last_event_name end,
    last_event_at = greatest(k.last_event_at, m.last_event_at),
    ai_last_status_note = case when m.ai_last_analyzed_at is not null and (k.ai_last_analyzed_at is null or m.ai_last_analyzed_at > k.ai_last_analyzed_at)
                            then m.ai_last_status_note else k.ai_last_status_note end,
    ai_last_analyzed_at = greatest(k.ai_last_analyzed_at, m.ai_last_analyzed_at),
    quo_synced_at = coalesce(k.quo_synced_at, m.quo_synced_at),
    dialer_contacted_at = greatest(k.dialer_contacted_at, m.dialer_contacted_at),
    dialer_snoozed_at = greatest(k.dialer_snoozed_at, m.dialer_snoozed_at),
    event_followup_contacted_at = greatest(k.event_followup_contacted_at, m.event_followup_contacted_at),
    event_followup_snoozed_at = greatest(k.event_followup_snoozed_at, m.event_followup_snoozed_at),
    notes = nullif(trim(both E'\n' from
      coalesce(k.notes, '') ||
      case when m.notes is not null and m.notes <> '' then
        (case when coalesce(k.notes, '') <> '' then E'\n\n' else '' end) || '[Merged from duplicate contact] ' || m.notes
      else '' end
    ), '')
  from public.contacts m
  where k.id = keep_id and m.id = merge_id;

  insert into public.contact_tags (contact_id, tag_id)
  select keep_id, tag_id from public.contact_tags where contact_id = merge_id
  on conflict (contact_id, tag_id) do nothing;
  delete from public.contact_tags where contact_id = merge_id;

  update public.activities set contact_id = keep_id where contact_id = merge_id;
  update public.tasks set contact_id = keep_id where contact_id = merge_id;
  update public.important_dates set contact_id = keep_id where contact_id = merge_id;
  update public.ai_insights set contact_id = keep_id where contact_id = merge_id;
  update public.deals set contact_id = keep_id where contact_id = merge_id;

  delete from public.email_sequence_enrollments e
  where e.contact_id = merge_id
    and exists (select 1 from public.email_sequence_enrollments k2 where k2.contact_id = keep_id and k2.sequence_id = e.sequence_id);
  update public.email_sequence_enrollments set contact_id = keep_id where contact_id = merge_id;

  delete from public.email_sequence_sends s
  where s.contact_id = merge_id
    and exists (select 1 from public.email_sequence_sends k2 where k2.contact_id = keep_id and k2.step_id = s.step_id);
  update public.email_sequence_sends set contact_id = keep_id where contact_id = merge_id;

  delete from public.email_sequence_exclusions x
  where x.contact_id = merge_id
    and exists (select 1 from public.email_sequence_exclusions k2 where k2.contact_id = keep_id and k2.sequence_id = x.sequence_id);
  update public.email_sequence_exclusions set contact_id = keep_id where contact_id = merge_id;

  delete from public.contacts where id = merge_id;
end;
$$;
