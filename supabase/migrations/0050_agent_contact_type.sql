-- Agent recruiting belongs on real contacts, not the standalone
-- agent_recruits table from 0049 - "agent" wasn't its own contact_type
-- yet, so agents she knows were sitting under "vendor" mixed in with
-- actual service vendors (lenders, title, photographers), which is
-- exactly the mixup she flagged. Adds "agent" as its own type and the
-- handful of recruiting-specific fields directly on contacts, matching
-- how every other type-specific concept here (representing, budget_min,
-- lease_ends_at, ...) already lives on the one wide contacts table
-- rather than a satellite one - same precedent as 0026 adding
-- "attendee" the same way.
--
-- recruit_stage null = top of funnel ("Introduced") - the moment she
-- marks a contact as an agent, they're automatically in the recruiting
-- funnel with no separate "add to pipeline" step. Non-null values track
-- the rest of the lifecycle.
alter table public.contacts drop constraint if exists contacts_contact_type_check;
alter table public.contacts add constraint contacts_contact_type_check
  check (contact_type in ('buyer', 'seller', 'both', 'investor', 'renter', 'referral_partner', 'vendor', 'past_client', 'sphere', 'attendee', 'agent', 'other'));

alter table public.contacts add column recruit_stage text
  check (recruit_stage in ('connected_with_lead', 'joined', 'fee_received', 'not_moving_forward'));
alter table public.contacts add column referral_fee numeric;
alter table public.contacts add column recruit_joined_at timestamptz;
alter table public.contacts add column recruit_fee_received_at timestamptz;

drop table if exists public.agent_recruits;
