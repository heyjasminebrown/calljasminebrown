-- Deals gets the data a closed transaction actually needs to be useful:
-- what closed, what side, what it sold for, what she made, when the
-- relationship started (for a lead-to-close time reference), and freeform
-- notes for spotting patterns in what predicts a close. All nullable/added
-- after the base insert - the celebration modal fills these in as a second
-- step, so a deal still exists (and counts toward conversion rate) even if
-- she closes the modal without finishing it.
alter table public.deals
  add column address text,
  add column property_type text
    check (property_type in ('primary_residence', 'house_hack', 'investment', 'co_living', 'other')),
  add column side text check (side in ('buyer', 'seller')),
  add column sale_price numeric,
  add column commission_amount numeric,
  add column lead_started_at timestamptz,
  add column notes text;
