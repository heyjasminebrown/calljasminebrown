-- Text campaign "skip" options:
-- * skip_tag_ids: anyone with one of these tags isn't added (and someone
--   already in progress who gets one stops before the next text).
-- * skip_replied_campaign_ids: anyone who texted back after one of these
--   campaigns reached them isn't added (e.g. they already RSVP'd).
--   (skip_campaign_ids, from 0087, skips everyone who was in a campaign.)
alter table public.text_campaigns add column if not exists skip_tag_ids uuid[] not null default '{}';
alter table public.text_campaigns add column if not exists skip_replied_campaign_ids uuid[] not null default '{}';

create or replace function public.enroll_in_text_campaigns(p_contact_id uuid, p_owner_id uuid, p_trigger text, p_value text)
returns void as $$
begin
  insert into public.text_automation_enrollments (owner_id, contact_id, campaign_id, campaign, next_step, next_send_at)
  select p_owner_id, p_contact_id, c.id, c.id::text, c.steps->0->>'id', now()
  from public.text_campaigns c
  where c.owner_id = p_owner_id
    and c.active
    and c.trigger_type = p_trigger
    and jsonb_array_length(c.steps) > 0
    and (case when p_trigger = 'source'
              then lower(trim(c.trigger_value)) = lower(trim(coalesce(p_value, '')))
              else c.trigger_value = p_value end)
    and not exists (
      select 1 from public.text_automation_enrollments x
      where x.contact_id = p_contact_id and x.campaign_id = any(c.skip_campaign_ids)
    )
    and not exists (
      select 1 from public.contact_tags ct
      where ct.contact_id = p_contact_id and ct.tag_id = any(c.skip_tag_ids)
    )
    and not exists (
      select 1 from public.text_automation_enrollments x
      join public.activities a on a.contact_id = x.contact_id
      where x.contact_id = p_contact_id
        and x.campaign_id = any(c.skip_replied_campaign_ids)
        and a.type = 'text' and a.direction = 'inbound'
        and a.occurred_at >= x.enrolled_at
    )
  on conflict (contact_id, campaign) do nothing;
end;
$$ language plpgsql security definer set search_path = public;
