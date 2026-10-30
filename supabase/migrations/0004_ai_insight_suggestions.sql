-- Lets an AI insight carry a concrete suggested stage/timeline change for
-- the contact page to offer as Apply/Dismiss, instead of the AI silently
-- changing the contact's actual stage/timeline itself.

alter table public.ai_insights
  add column suggested_stage_id uuid references public.pipeline_stages(id) on delete set null,
  add column suggested_timeline text
    check (suggested_timeline in ('asap', '1_3_months', '3_6_months', '6_12_months', '12_plus_months', 'just_browsing', 'unknown')),
  add column applied boolean not null default false;
