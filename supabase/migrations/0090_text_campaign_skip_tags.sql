-- "Skip anyone tagged ..." on text campaigns: a contact with any of these
-- tags isn't enrolled (and an in-progress one stops before the next text).
alter table public.text_campaigns add column if not exists skip_tag_ids uuid[] not null default '{}';

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
  on conflict (contact_id, campaign) do nothing;
end;
$$ language plpgsql security definer set search_path = public;
