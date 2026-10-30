-- Everything built so far (budget, areas of interest, timeline) is buyer-
-- shaped. Sellers need the mirror of that (a listing address and when they
-- plan to list), and every contact needs a simple "which side of a
-- transaction are they" signal distinct from contact_type - contact_type
-- mixes in categories (investor, referral_partner, vendor, sphere) that
-- aren't really about buy/sell side at all.
alter table public.contacts
  add column representing text check (representing in ('buyer', 'seller', 'both')),
  add column listing_address text,
  add column listing_timeline text
    check (listing_timeline in ('asap', '1_3_months', '3_6_months', '6_12_months', '12_plus_months', 'just_browsing', 'unknown'));

-- Best-effort backfill from contact_type where it clearly implies a side -
-- referral partners/vendors/sphere/other are left null (no badge shown)
-- since they're not actively transacting. Anything backfilled wrong is a
-- one-field edit on the contact.
update public.contacts set representing = 'seller' where contact_type = 'seller';
update public.contacts set representing = 'both' where contact_type = 'both';
update public.contacts set representing = 'buyer' where contact_type in ('buyer', 'investor', 'renter', 'past_client');
