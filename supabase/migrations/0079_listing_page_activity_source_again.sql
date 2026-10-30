-- unlockListingFinancials writes source='listing_page'. 0074 added that
-- value, but every earlier activities_source_check rewrite replaced the
-- whole list. If live is still on 0063 (or any rewrite that omitted
-- listing_page), upsertActivity throws check_violation and the public OM
-- unlock catch returns "Could not unlock. Try again."
-- Idempotent: drop + add the same allowed set as 0074.
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
