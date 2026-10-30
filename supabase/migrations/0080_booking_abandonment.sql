-- One push + Today follow-up per CRM Booking-screen attempt that sat in
-- info / time_selected for 10+ minutes. Completing the booking (pending
-- or later) drops the row out of that stage set, so a late submit after
-- the nudge does not keep the card or fire again.
alter table public.booking_requests add column if not exists abandonment_notified_at timestamptz;
