-- Automated text campaigns (first: "Conventus Text Campaign"). One row per
-- contact per campaign tracks where they are: the next text to send and
-- when, the last one sent, and the Quo message ids the automation sent (so
-- a text Jasmine sends herself can be told apart and stop the automation).
create table if not exists public.text_automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  campaign text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'stopped')),
  stop_reason text,
  next_step text,
  next_send_at timestamptz,
  last_step text,
  last_sent_at timestamptz,
  sent_message_ids text[] not null default '{}',
  failed_attempts integer not null default 0,
  last_error text,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, campaign)
);

create index if not exists text_automation_enrollments_due_idx
  on public.text_automation_enrollments (status, next_send_at);

alter table public.text_automation_enrollments enable row level security;

drop policy if exists "owner full access" on public.text_automation_enrollments;
create policy "owner full access" on public.text_automation_enrollments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Any NEW contact whose source is Conventus (however it's added: the form,
-- an import, an integration) is enrolled, starting with Text 1 right away.
create or replace function public.enroll_text_automation()
returns trigger as $$
begin
  if lower(trim(coalesce(new.lead_source, ''))) = 'conventus' then
    insert into public.text_automation_enrollments (owner_id, contact_id, campaign, next_step, next_send_at)
    values (new.owner_id, new.id, 'conventus', 't1', now())
    on conflict (contact_id, campaign) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists contacts_enroll_text_automation on public.contacts;
create trigger contacts_enroll_text_automation
  after insert on public.contacts
  for each row execute function public.enroll_text_automation();
