-- Her real funnel has one more step than 0050 modeled: null wasn't
-- "Introduced" after all - it's "Potential," the just-tagged-Agent
-- bucket she hasn't done anything with yet. "Introduced" becomes its
-- own explicit stage, sitting between Potential and Connected with team
-- lead (an actual conversation happening). Full funnel: Potential (null)
-- -> Introduced -> Connected with team lead -> Joined the office ->
-- Fee received, with Not moving forward as an exit at any point.
alter table public.contacts drop constraint if exists contacts_recruit_stage_check;
alter table public.contacts add constraint contacts_recruit_stage_check
  check (recruit_stage in ('introduced', 'connected_with_lead', 'joined', 'fee_received', 'not_moving_forward'));
