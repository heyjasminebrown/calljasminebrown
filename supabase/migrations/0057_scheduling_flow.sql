-- Reshapes booking_requests from a single-shot submission into a
-- progressive session: a row is created the moment someone gives their
-- name/phone (stage 'info'), before they've even picked a time - that's
-- the "abandoned cart" visibility she asked for (anyone who starts but
-- never finishes still shows up for her to follow up with). The same
-- row is updated in place as they move through picking a time
-- ('time_selected') and filling in the prep-for-the-meeting details
-- ('pending' - ready for her review), through to her decision.
alter table public.booking_requests rename column status to stage;
alter table public.booking_requests alter column stage set default 'info';
alter table public.booking_requests alter column starts_at drop not null;
alter table public.booking_requests alter column ends_at drop not null;
alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests add constraint booking_requests_stage_check
  check (stage in ('info', 'time_selected', 'pending', 'approved', 'declined', 'canceled'));

-- What she asked the prep step to collect, so it can both show up in her
-- approval notification and enrich the contact record directly (see
-- app/book/booking-actions.ts's submitBookingDetails).
alter table public.booking_requests add column contact_type text;
alter table public.booking_requests add column timeline text;
alter table public.booking_requests add column notes text;
alter table public.booking_requests add column questions text;
-- Distinct from created_at (when they first gave their name/phone) and
-- decided_at (when she approved/declined) - when the prep form was
-- actually submitted and the request became hers to review.
alter table public.booking_requests add column submitted_at timestamptz;

-- The generic, no-login-needed /book address needs no booking_links row
-- at all (there's only one owner, nothing to disambiguate) - only a
-- contact-specific /book/{slug} link still needs one, for the prefill.
-- A request that came in through the bare /book address has no link to
-- point at, so this can no longer be required.
alter table public.booking_requests alter column booking_link_id drop not null;

-- Every remaining booking_links row is now contact-specific by
-- definition - drop whatever generic (contact_id null) row this session
-- already created under the old design, since nothing looks those up
-- anymore, then make that the enforced shape going forward.
delete from public.booking_links where contact_id is null;
alter table public.booking_links alter column contact_id set not null;
