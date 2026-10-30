-- "Replies owed" gets a per-message dismiss: sometimes the last inbound
-- text just doesn't need a reply for reasons the AI classifier couldn't
-- know (already handled it another way, decided not to respond, etc.).
-- Deliberately a separate column from reply_reminder_sent_at (not reused)
-- and keyed to this specific activity row, not the contact - a contact
-- texting again later gets a brand-new row with reply_dismissed_at still
-- null, so dismissing today's message can never suppress a genuinely new
-- one next week.
alter table public.activities add column reply_dismissed_at timestamptz;
