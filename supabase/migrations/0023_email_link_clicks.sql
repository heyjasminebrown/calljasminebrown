-- Per-link click events, one row per click. email_sequence_sends only ever
-- tracked "did they click something in this email" (one clicked_at/
-- click_count pair per send) - this adds the "which specific link"
-- granularity needed to see which link in a multi-link email actually
-- gets used, and by whom.
create table public.email_link_clicks (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.email_sequence_sends(id) on delete cascade,
  url text not null,
  clicked_at timestamptz not null default now()
);

create index email_link_clicks_send_idx on public.email_link_clicks(send_id);
create index email_link_clicks_url_idx on public.email_link_clicks(url);

alter table public.email_link_clicks enable row level security;

create policy "owner full access via send" on public.email_link_clicks
  for all
  using (exists (
    select 1 from public.email_sequence_sends snd
    join public.email_sequences s on s.id = snd.sequence_id
    where snd.id = send_id and s.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.email_sequence_sends snd
    join public.email_sequences s on s.id = snd.sequence_id
    where snd.id = send_id and s.owner_id = auth.uid()
  ));
