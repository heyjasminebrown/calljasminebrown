-- Text campaigns built in the CRM (Campaigns page) instead of in code.
-- A campaign has a trigger and an ordered list of texts (steps, as JSON):
--   [{ "id": "t1", "label": "Text 1", "body": "Hey [First Name]...",
--      "onReply":   { "next": "t2" | null },
--      "onNoReply": { "next": "t3" | null, "days": 1, "time": "16:30" } }]
-- The first step goes out right away. "onReply" = a reply that isn't a
-- clear no (sent about a minute after the reply); "onNoReply" = sent N days
-- after this text at a set Eastern time. null ends the campaign.
-- Stop rules (STOP, a clear no, archived/spam, Jasmine texting or calling
-- them) are enforced by the sending engine for every campaign.
create table if not exists public.text_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  active boolean not null default false,
  trigger_type text not null check (trigger_type in ('source', 'tag', 'type', 'stage')),
  trigger_value text not null,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.text_campaigns enable row level security;
drop policy if exists "owner full access" on public.text_campaigns;
create policy "owner full access" on public.text_campaigns
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Enrollments point at a campaign row now. (`campaign` keeps holding the
-- campaign id as text, so the existing unique (contact_id, campaign) still
-- means "each contact goes through a campaign once".)
alter table public.text_automation_enrollments
  add column if not exists campaign_id uuid references public.text_campaigns(id) on delete cascade;
-- true while the next text is the "they replied" text (sent ~1 min after).
alter table public.text_automation_enrollments
  add column if not exists reply_scheduled boolean not null default false;

-- The Conventus campaign, moved from code into a campaign row (kept on).
insert into public.text_campaigns (owner_id, name, active, trigger_type, trigger_value, steps)
select o.owner_id, 'Conventus Text Campaign', true, 'source', 'Conventus', $json$[
  {"id":"t1","label":"Text 1","body":"Hey [First Name], it's Jasmine 🙂. I came across a recent project of yours, but wasn't sure if you were looking for your next deal by chance?","onReply":{"next":"t2"},"onNoReply":{"next":"t3","days":1,"time":"16:30"}},
  {"id":"t2","label":"Text 2","body":"Oh nice! Depending on what you're looking for, I might be a good resource for your next deal. I'll give you a quick call to hear more.","onReply":{"next":null},"onNoReply":{"next":null}},
  {"id":"t3","label":"Text 3","body":"Curious if you've got your next project lined up already or if you're still looking?","onReply":{"next":"t2"},"onNoReply":{"next":"t4","days":7,"time":"17:45"}},
  {"id":"t4","label":"Text 4","body":"Are you still investing right now, or taking a little break between projects?","onReply":{"next":null},"onNoReply":{"next":null}}
]$json$::jsonb
from (select distinct owner_id from public.pipeline_stages) o
where not exists (select 1 from public.text_campaigns c where c.owner_id = o.owner_id and c.name = 'Conventus Text Campaign');

update public.text_automation_enrollments e
set campaign_id = c.id, campaign = c.id::text
from public.text_campaigns c
where e.campaign = 'conventus' and c.owner_id = e.owner_id and c.name = 'Conventus Text Campaign';

-- One enrollment function for every trigger. Only ACTIVE campaigns enroll,
-- so turning a campaign on doesn't text everyone who matched while it was off.
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
  on conflict (contact_id, campaign) do nothing;
end;
$$ language plpgsql security definer set search_path = public;

-- New contact: Source (new contacts only), plus Type and Stage it starts with.
create or replace function public.text_campaigns_on_contact_insert()
returns trigger as $$
begin
  perform public.enroll_in_text_campaigns(new.id, new.owner_id, 'source', new.lead_source);
  perform public.enroll_in_text_campaigns(new.id, new.owner_id, 'type', new.relationship_type);
  if new.stage_id is not null then
    perform public.enroll_in_text_campaigns(new.id, new.owner_id, 'stage', new.stage_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Existing contact whose Type or Stage changes.
create or replace function public.text_campaigns_on_contact_update()
returns trigger as $$
begin
  if new.relationship_type is distinct from old.relationship_type then
    perform public.enroll_in_text_campaigns(new.id, new.owner_id, 'type', new.relationship_type);
  end if;
  if new.stage_id is distinct from old.stage_id and new.stage_id is not null then
    perform public.enroll_in_text_campaigns(new.id, new.owner_id, 'stage', new.stage_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- A tag added to a contact.
create or replace function public.text_campaigns_on_tag_added()
returns trigger as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.contacts where id = new.contact_id;
  if v_owner is not null then
    perform public.enroll_in_text_campaigns(new.contact_id, v_owner, 'tag', new.tag_id::text);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists contacts_enroll_text_automation on public.contacts;
drop function if exists public.enroll_text_automation();

drop trigger if exists contacts_text_campaigns_insert on public.contacts;
create trigger contacts_text_campaigns_insert
  after insert on public.contacts
  for each row execute function public.text_campaigns_on_contact_insert();

drop trigger if exists contacts_text_campaigns_update on public.contacts;
create trigger contacts_text_campaigns_update
  after update of relationship_type, stage_id on public.contacts
  for each row execute function public.text_campaigns_on_contact_update();

drop trigger if exists contact_tags_text_campaigns on public.contact_tags;
create trigger contact_tags_text_campaigns
  after insert on public.contact_tags
  for each row execute function public.text_campaigns_on_tag_added();
