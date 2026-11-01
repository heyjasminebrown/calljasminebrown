# CRM setup status

Live site: https://www.calljasminebrown.com · Live branch: `claude/peaceful-curie-mb14vu`
(Vercel production branch). Supabase migrations through 0084 have been run.

## Done
- Supabase, Vercel, sign-in, Gmail + Calendar (Google Workspace, Internal app)
- Type (Community/Prospect/Client/Referral Partner) and Stages (Cold/Warm/Hot/Nurture)
- Error banner for background failures; Gmail "Sync now" in Settings
- Timeline and Representing removed (code and data)
- Eventbrite code built; `EVENTBRITE_WEBHOOK_SECRET` and `EVENTBRITE_PRIVATE_TOKENS`
  are saved in Vercel

## Next: Eventbrite (pick up here)
Already done: both keys are in Vercel, and the production site was redeployed with them
(after `fae306b`), so the CRM is ready to receive Eventbrite webhooks.

1. **Have your webhook password ready.** It's the value of `EVENTBRITE_WEBHOOK_SECRET` in
   Vercel. If it was saved as a Secret and you don't have a copy: Vercel -> Settings ->
   Environment Variables -> `EVENTBRITE_WEBHOOK_SECRET` -> ⋯ -> Edit -> paste a new random
   string (keep a copy) -> Save -> redeploy the blue Production row.
2. **Add the webhook in the first Eventbrite account:** profile icon -> Account Settings ->
   Developer Links -> Webhooks -> Add webhook
   - Payload URL: `https://www.calljasminebrown.com/api/webhooks/eventbrite?secret=YOURSECRET`
     (YOURSECRET = the password from step 1, no spaces)
   - Event: All events · Actions: `order.placed` and `attendee.checked_in` only
   - Add webhook. If there's a Test button, click it; a red CRM banner saying the secret is
     incorrect means the URL password doesn't match Vercel.
3. **Repeat step 2 in the second Eventbrite account.**
4. **Test:** register for one of your own events with a free ticket. Within a minute you
   should appear in Contacts, tagged with the event name, with "Registered for [event]" on
   your timeline.

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
- **Starter tags** are real-estate ones (VIP, First-Time Buyer, Cash Buyer, Investor...).
  Replace with a lending set (e.g. Pre-Approved, Refinance, Realtor Partner, HELOC)?
- **App name:** "Jasmine CRM" today. Rename (e.g. "CallJasmine")?
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
