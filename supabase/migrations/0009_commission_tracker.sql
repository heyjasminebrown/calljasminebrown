-- Renamed to make clear this is the pre-split total earned on her side
-- (matches "Gross Comp" on her commission tracker spreadsheet), not a
-- final take-home figure. The KW/KWRI/FMLS/TC splits and referral fee
-- are computed live in the commission tracker page rather than stored,
-- so editing a deal's price/commission/referral%, or the order deals
-- closed in, recalculates correctly instead of leaving stale amounts
-- behind - same reasoning as deals.stage_id not being duplicated
-- anywhere else.
alter table public.deals rename column commission_amount to gross_commission;

alter table public.deals
  add column referral_pct numeric,
  add column misc_fee numeric not null default 0,
  add column oz_fee numeric not null default 0;
