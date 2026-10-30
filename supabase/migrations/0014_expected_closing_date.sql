-- closed_at already means "entered under contract at" while a deal is
-- pending, and gets overwritten with the real close date once it closes -
-- there's no room in it for the target closing date the contract itself
-- specifies, which is known (and worth tracking) well before either of
-- those things happen.
alter table public.deals
  add column expected_closing_date date;
