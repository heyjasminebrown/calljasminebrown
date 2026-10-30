-- A spam-flagged call still needs its auto-created contact to exist (so the
-- bucket has something to show and "Not spam" has something to recover) -
-- it's deliberately not archived. archived stays reserved for "hidden /
-- soft-trashed by the owner"; spam is its own flag so the two states don't
-- collide (an archived-but-not-spam contact must never show in the bucket,
-- and Settings' allowlist below must survive even if she later archives the
-- contact by hand).
alter table public.contacts add column spam boolean not null default false;

-- What "Not spam" writes: phone stored as normalized last-10-digits (see
-- lib/phone.ts's normalizePhone) so a rule never re-matches that number
-- again, regardless of how it's formatted on a future inbound call.
create table public.spam_number_allowlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, phone)
);

alter table public.spam_number_allowlist enable row level security;
create policy "owner full access" on public.spam_number_allowlist
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Settings → Spam filters' per-rule toggles. Keyed on the rule's reason
-- string (the exact label shown in the bucket and in Settings) rather than
-- a separate id scheme - it's already the natural, unique key. No row for
-- a rule means it's enabled (the default); a row only exists once she's
-- turned one off.
create table public.spam_rule_overrides (
  owner_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  enabled boolean not null default true,
  primary key (owner_id, reason)
);

alter table public.spam_rule_overrides enable row level security;
create policy "owner full access" on public.spam_rule_overrides
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
