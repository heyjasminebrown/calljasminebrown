-- Course-correction from 0050: "agent" doesn't belong as its own
-- contact_type. A recruit can genuinely also be a vendor (a title/lender
-- contact she's recruiting into the office) and contact_type is
-- exclusive - one value per contact - so forcing it to "agent" would
-- have erased their real category. Recruiting status is a tag instead
-- ("Agent"), same as any other cross-cutting label: a contact can carry
-- both "Vendor" as their type and "Agent" as a tag at once.
--
-- The recruit_stage/referral_fee/recruit_joined_at/recruit_fee_received_at
-- columns added by 0050 stay exactly as they are - only the entry
-- signal (contact_type -> tag) changes, so nothing about how a recruit
-- moves through the pipeline needs to move.
update public.contacts set contact_type = 'vendor' where contact_type = 'agent';

alter table public.contacts drop constraint if exists contacts_contact_type_check;
alter table public.contacts add constraint contacts_contact_type_check
  check (contact_type in ('buyer', 'seller', 'both', 'investor', 'renter', 'referral_partner', 'vendor', 'past_client', 'sphere', 'attendee', 'other'));

insert into public.tags (owner_id, name, color)
select u.id, 'Agent', '#f59e0b'
from auth.users u
where not exists (
  select 1 from public.tags t where t.owner_id = u.id and t.name = 'Agent'
);
