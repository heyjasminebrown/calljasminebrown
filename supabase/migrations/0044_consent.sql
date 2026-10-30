-- Phase 4 Stop 2: consent tracking. Every contact records how permission
-- was given and when - a real gap flagged in the handoff itself
-- ("collected today and not written down" at check-in). Fines here are
-- per message, so unlike most of this app's "suggest, don't enforce"
-- posture, bulk sending is a hard filter on opted_out_at.
alter table public.contacts add column consent_source text;
alter table public.contacts add column consent_at timestamptz;
alter table public.contacts add column opted_out_at timestamptz;
