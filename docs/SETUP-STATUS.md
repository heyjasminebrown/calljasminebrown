# CRM setup status

Live site: https://www.calljasminebrown.com · Live branch: `claude/peaceful-curie-mb14vu`
(Vercel production branch). Supabase migrations through 0084 have been run.

## Done
- Supabase, Vercel, sign-in, Gmail + Calendar (Google Workspace, Internal app)
- Type (Community/Prospect/Client/Referral Partner) and Stages (Cold/Warm/Hot/Nurture)
- Error banner for background failures; Gmail "Sync now" in Settings
- Timeline and Representing removed (code and data)
- Eventbrite connected (both accounts): registrations add/match the contact, tag them with
  the event name and log "Registered for [event]" (confirmed working). Matching is by email
  or phone. Check-ins (Eventbrite Organizer app) log "Attended" and feed the Events filter -
  not yet tested.
- App renamed to CallJasmineBrown; tags can be created right on a contact

## Waiting on something outside the CRM
- **Quo calls/texts:** retest once A2P verification is approved. Text and call the Quo number,
  then check Messages, and send a text from a contact. Keys and webhook are already set up.
  - If the Quo account has 2+ numbers, add `QUO_SEND_PHONE_NUMBER` in Vercel.
  - Quo deliveries currently arrive with no signature header (logged as a warning, still
    accepted). After a real delivery works, check the header and decide whether to set
    `CRM_QUO_ENFORCE_SIGNATURE=true`.
  - In Quo -> Settings -> API, delete the old "CRM" key from Oct 30 if it's still there.

## Needs your action before it's fully "yours"
- **Your phone number on public pages:** the booking page shows a placeholder `000-000-0000`.
  Add `NEXT_PUBLIC_OWNER_PHONE_E164` (e.g. `+14047895791`) and `NEXT_PUBLIC_OWNER_PHONE_DISPLAY`
  (e.g. `(404) 789-5791`) in Vercel, then redeploy.
- **Company name** (`COMPANY_NAME` in `lib/brand/identity.ts`) is blank, so emails are signed
  just "Jasmine Brown". Give Claude the company name if you want it added.
- **Text message wording:** first-touch and text-blast templates
  (`lib/crm/new-lead-text-templates.ts`, `lib/crm/text-blast-templates.ts`) are generic
  placeholder copy. Rewrite them in your voice before texting leads from the CRM.
- **Contact Types:** every existing contact is Community. Update Prospects/Clients/Referral
  Partners (bulk: select contacts -> Change type) so filters and Prospect -> Client
  conversion reporting mean something.

## Decisions still open
- **"Original Email List" source:** not one of the seven sources (Event, Facebook, Instagram,
  YouTube, TikTok, Website, Conventus), so those contacts only show under "All". Add it as an
  eighth source, or bulk-change them?
- **Tags:** the account currently has no tags (beyond event tags). Create a starter set
  (e.g. Pre-Approved, Refinance, Realtor Partner, HELOC) or just add them as you go.
- **Eventbrite with a new email on an existing contact:** the new email isn't saved today.
  Save it to the empty Secondary email field instead?
- **Contacts page subtitle** still says "leads from Zillow, referrals, events, and more".
  Pick new wording.

## Quick checks to confirm
- Merge two duplicate contacts once (merge function was rewritten in migration 0084).
- A small import with Type and Stage columns (and an "Email 2" column) lands correctly.
- Events filter (Ever attended / Specific event) fills in once Eventbrite check-ins arrive.

## Worth a review (leftovers from the real-estate version)
- Reports page: some reports (deal forecast, commission-style numbers) assume deals/closings
  that no longer exist in this CRM. Remove what you don't use.
- Public booking page (`/book`) wording and questions.
- Pipeline won/lost tracking is gone (stages are only Cold/Warm/Hot/Nurture).

## Optional integrations (not set up)
- **Supabase custom SMTP:** removes the "open the sign-in link in the same browser" limit and
  Supabase's few-emails-per-hour cap; lets you brand the sign-in email.
- **Push notifications** (VAPID keys): needed for phone alerts, including error alerts.
- **AI insights** (`ANTHROPIC_API_KEY`): suggested stage/tag changes from calls, texts, emails.
- Calendly, Granola, Instagram DMs, Blinq: steps in README.
