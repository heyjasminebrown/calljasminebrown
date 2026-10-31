-- A second email per contact (e.g. work + personal). Used for search,
-- duplicate checks, and matching inbound mail/meetings to the contact;
-- outbound sends (sequences, batch emails) still go to `email` only.
alter table public.contacts add column if not exists secondary_email text;
