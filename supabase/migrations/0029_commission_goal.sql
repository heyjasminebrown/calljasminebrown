alter table public.metric_goals drop constraint if exists metric_goals_metric_key_check;
alter table public.metric_goals add constraint metric_goals_metric_key_check
  check (metric_key in ('speed_to_lead', 'contacted_pct', 'follow_up_rate', 'conversion_rate', 'commission_goal'));
