# CRM setup status

Live site: https://www.calljasminebrown.com · Live branch: `claude/peaceful-curie-mb14vu`
(Vercel production branch). Supabase migrations through 0088 have been run. 0090 has been run. **0091 (multi-tag campaign trigger) needs to be run**; 0089 (team logins) too if not done yet.

## Done
- Supabase, Vercel, sign-in, Gmail + Calendar (Google Workspace, Internal app), Gmail Sync now
- App name **CallJasmineBrown**; brand colors; headshot; favicon
- Type (Community/Prospect/Client/Referral Partner) and Stages (Cold/Warm/Hot/Nurture),
  color-coded everywhere
- Cold Prospects who reply to a campaign (automated text campaign, text blast, or email
  sequence) move to Warm automatically, unless the reply is STOP/unsubscribe or a clear no
- Timeline and Representing removed (code and data)
- Eventbrite connected (both accounts): registrations add/match the contact (by email or
  phone), tag the event, log "Registered for [event]"; new contacts get source "Event";
  a different registration email replaces the Secondary email (never the primary)
- Scorecard: Today (Pipeline + Conversion, Outreach; 7d/30d/this month/last month) and
  Reports (30d/90d/year + Jan-Dec trend per metric)
- Lead sources: type a new one on any contact and it appears everywhere (incl. Filters);
  "Original Email List" is left out of New / Uncontacted
- Tags can be created right on a contact and on Add contact
- Error banner for background failures
- Text campaign builder (Campaigns -> Automated text campaigns): triggers on Source (new
  contacts), tag added, Type, or Stage; stop rules, 2/min throttle and 9 AM-8 PM ET always
  enforced; each contact goes through a campaign once. "Right after" timing, Duplicate,
  "skip anyone already in" other campaigns, and "add everyone who already matches".
- Public pages show (404) 383-5256; emails signed just "Jasmine Brown" (no company name)

## Booking / Schedule
- More -> Schedule: booking calendars (Calendly-style: name, link, length, days/hours,
  buffer, how far ahead, minimum notice; duplicate, pause, delete, main calendar).
- Public page books instantly: Google Calendar event + Meet link + emailed invite,
  confirmation text, meeting on the contact (new contacts get Source "Website"), push.
  If Google refuses, the booking waits under Schedule -> "Needs your approval".
- heyjasminebrown.com/meet (main calendar) and /meet/<link> embed the CRM's /book page.
- Upcoming Meetings on Today = every CRM meeting (bookings, meetings scheduled from a
  contact, Calendly), cancelled Google events dropped.
- Outlook (jbrown@cvlending.com): busy times read from the published ICS link
  (`OUTLOOK_CALENDAR_ICS_URL` in Vercel) so bookings never land on Outlook meetings; every
  CRM meeting invite also invites jbrown@cvlending.com (`OUTLOOK_CALENDAR_EMAIL` to change).

## Team logins
- Settings -> Team: add a helper's email; they sign in at /login with their own email and work
  in this CRM (same data). Database rules use crm_owner_id() (migration 0089); in the app,
  auth.getUser() returns the owner's id for a team member (lib/supabase/team-identity.ts).

## Quo
- A2P approved; calls and texts log; `TEXT_AUTOMATION_ENABLED=true` is on.
- Quo deliveries arrive with no signature header (logged as a warning, still accepted).
  Decide later whether to set `CRM_QUO_ENFORCE_SIGNATURE=true`.
- In Quo -> Settings -> API, delete the old "CRM" key from Oct 30 if it's still there.
- Calls answered by Quo's AI agent: logged from the recording/transcript events (fixed
  2026-11-01). Confirm with one test call.

## Needs your action
- **Text message wording:** first-touch and text-blast templates
  (`lib/crm/new-lead-text-templates.ts`, `lib/crm/text-blast-templates.ts`) are generic
  placeholder copy ("Hi Melissa, this is Jasmine Brown..."). Rewrite them in your voice before
  texting from the CRM (Settings -> Text templates, or give Claude the wording).
- **Contact Types:** keep moving Prospects/Clients/Referral Partners off Community
  (bulk: select contacts -> Change type) so Conversion numbers mean something.

## Optional / still open
- **Starter tags:** none exist beyond event tags. Create a set (e.g. Pre-Approved, Refinance,
  Realtor Partner, HELOC) or add them as you go.

## Quick checks to confirm
- Merge two duplicate contacts once (merge function was rewritten in migration 0084).
- A small import with Type and Stage columns (and an "Email 2" column) lands correctly.
- Eventbrite check-in: check someone in with Eventbrite Organizer -> "Attended [event]" on
  their timeline, and they appear under Filters -> Events.

## Worth a review (leftovers from the real-estate version)
- Reports page: older reports (deal forecast, commission numbers, speed to lead...) assume
  deals/closings that no longer exist here. Remove what you don't use.
- Public booking page (`/book`) wording and questions.
- Pipeline won/lost tracking is gone (stages are only Cold/Warm/Hot/Nurture).

## Optional integrations (not set up)
- **Supabase custom SMTP:** removes the "open the sign-in link in the same browser" limit and
  Supabase's few-emails-per-hour cap; lets you brand the sign-in email.
- **Push notifications** (VAPID keys): needed for phone alerts, including error alerts.
- **AI insights** (`ANTHROPIC_API_KEY`): suggested stage/tag changes from calls, texts, emails.
- Calendly, Granola, Instagram DMs, Blinq: steps in README.
