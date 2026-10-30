-- New "attendee" contact type: a meetup registrant (Eventbrite or Jotform)
-- whose real buyer/seller status isn't known yet - distinct from the
-- generic "other" catch-all, and left for manual reclassification
-- once it's clear which side of a transaction they're actually on.
alter table public.contacts drop constraint if exists contacts_contact_type_check;
alter table public.contacts add constraint contacts_contact_type_check
  check (contact_type in ('buyer', 'seller', 'both', 'investor', 'renter', 'referral_partner', 'vendor', 'past_client', 'sphere', 'attendee', 'other'));
