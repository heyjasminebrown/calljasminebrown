# CRM setup status

Live site: https://www.calljasminebrown.com · Live branch: `claude/peaceful-curie-mb14vu`
(Vercel production branch). Supabase migrations through 0084 have been run.

## Done
- Supabase, Vercel, sign-in, Gmail + Calendar (Google Workspace, Internal app), Gmail Sync now
- App name **CallJasmineBrown**; brand colors; headshot; favicon
- Type (Community/Prospect/Client/Referral Partner) and Stages (Cold/Warm/Hot/Nurture),
  color-coded everywhere; likelihood = Hot high / Warm medium / Cold+Nurture low (+1 if Engaged)
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

## Waiting on something outside the CRM
- **Quo calls/texts:** retest once A2P verification is approved. Text and call the Quo number,
  then check Messages, and send a text from a contact. Keys and webhook are already set up.
  - If the Quo account has 2+ numbers, add `QUO_SEND_PHONE_NUMBER` in Vercel.
  - Quo deliveries arrive with no signature header (logged as a warning, still accepted).
    After a real delivery works, check the header and decide on `CRM_QUO_ENFORCE_SIGNATURE=true`.
  - In Quo -> Settings -> API, delete the old "CRM" key from Oct 30 if it's still there.
  - Texts in the Outreach scorecard stay at 0 until this is live.

## Needs your action
- **Your phone number on public pages:** the booking page shows a placeholder `000-000-0000`.
  Add `NEXT_PUBLIC_OWNER_PHONE_E164` (e.g. `+14047895791`) and `NEXT_PUBLIC_OWNER_PHONE_DISPLAY`
  (e.g. `(404) 789-5791`) in Vercel, then redeploy.
- **Company name** (`COMPANY_NAME` in `lib/brand/identity.ts`) is blank, so emails are signed
  just "Jasmine Brown". Tell Claude the company name if you want it added.
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
