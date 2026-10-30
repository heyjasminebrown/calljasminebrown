-- Public listing OM pages log unlock/offer/seller-form activity with
-- source 'listing_page' (see app/listing/[slug]/actions.ts and
-- types/database.ts). The last activities_source_check rewrite
-- (0063_granola_activity_source.sql) never added that value, so those
-- inserts fail the check constraint: financials can still unlock in
-- memory, but the timeline row never writes and New Leads never sees
-- the listing lead.
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in (
    'manual',
    'quo',
    'gmail',
    'calendly',
    'eventbrite',
    'jotform',
    'house_hacking_site',
    'site_form',
    'checkin',
    'instagram',
    'blinq',
    'scheduling',
    'granola',
    'listing_page',
    'ai',
    'system'
  ));
