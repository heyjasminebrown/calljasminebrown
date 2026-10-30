-- Historical deals should carry the exact fees that were actually paid,
-- not our formula's best-effort reconstruction of them (which can't
-- perfectly reproduce every past exception). manual_split flips a deal
-- from "compute KW/KWRI/FMLS/TC from the formula" to "use these literal
-- amounts" - the KW/KWRI cap accumulators still add a manual deal's real
-- paid amount to the running total (so later deals in the same commission
-- year see accurate remaining cap room), it's just never clamped itself.
alter table public.deals
  add column manual_split boolean not null default false,
  add column kw_fee numeric,
  add column kwri_fee numeric,
  add column fmls_fee numeric,
  add column tc_fee numeric,
  add column referral_fee numeric;
