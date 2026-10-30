-- Tracks in-flight Gmail OAuth connect attempts server-side instead of via
-- a cookie. Google's redirect back to our callback is a cross-site
-- navigation, and some browsers don't reliably carry cookies across that
-- specific hop - so the CSRF-style state check can't depend on one.
create table if not exists gmail_oauth_states (
  state text primary key,
  created_at timestamptz not null default now()
);

alter table gmail_oauth_states enable row level security;
-- No policies: only the service-role client (connect/callback routes)
-- ever touches this table, never a browser session.
