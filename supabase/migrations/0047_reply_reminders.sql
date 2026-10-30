-- Adjustments round: "Replies owed" should only surface texts that
-- actually need a reply (not a closing "have a good night!" or "ok that
-- works"), and should be able to nudge with a push if she hasn't
-- answered yet.
--
-- needs_reply is set by the same AI call that already runs on every
-- inbound text (lib/ai/analyze-contact.ts) - null means "not evaluated"
-- (AI not configured, call failed, or predates this column), which the
-- reads/reminders below treat as "show it" / "don't nag" respectively -
-- see their own comments for why each direction is the safe default.
alter table public.activities add column needs_reply boolean;
alter table public.activities add column reply_reminder_sent_at timestamptz;
