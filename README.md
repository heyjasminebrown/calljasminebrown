# Lender CRM Chassis

A core CRM chassis — contacts, pipeline, dialer, texting, email sequences,
tasks, a daily "Today" worklist, and the auth/nav shell — extracted from a
real-estate-agent CRM and stripped of everything specific to that business,
so it's a clean starting point for a different relationship-driven business
(this copy was prepared for a mortgage lender).

**Stack:** Next.js 15 (App Router, TypeScript) · Supabase (Postgres, auth,
row-level security) · Tailwind CSS · Vercel (recommended host).

## Before you do anything else

1. **Edit [`lib/brand/identity.ts`](./lib/brand/identity.ts).** This is the
   one file that hardcodes who "you" are — your name, company name, app
   name, and a fallback phone number. It's commented `EDIT THIS FILE for
   your business`. Nothing else in the codebase should hardcode a person's
   name, brokerage/company name, or phone number; if you find something
   that does, it's a bug — please fix the reference to import from this
   file instead.
2. **Swap the headshot.** Replace `public/images/owner-headshot.jpg` (the
   path `OWNER_HEADSHOT_SRC` in `identity.ts` points at) with your own
   photo, same filename or update the constant.
3. **Review the outbound text/email templates.** `lib/crm/new-lead-text-templates.ts`
   and `lib/crm/text-blast-templates.ts` hold the actual message copy sent
   to leads (first-touch SMS, bulk text templates). They now read your name
   from `identity.ts`, but the *wording* is still generic placeholder copy
   — rewrite it to sound like you before this goes live. These are the
   messages that go out automatically from the dialer and sequences, so
   this is not optional polish.

## What's included

Core CRM chassis, usable by any relationship-driven, phone/email-heavy
business:

- **Contacts** — search/filter, full profile, tags, smart lists, merge/dedupe, bulk import, CSV export.
- **Pipeline** — customizable stages (kanban on desktop, accordion on mobile), deals (won/pending, generic — no brokerage-specific commission math), likelihood-to-close scoring.
- **Dialer** — a call-queue workflow with quick-pick text templates, call logging, and outcome tracking. See **Known limitation** below.
- **Messages** — a unified SMS/call inbox (via Quo), Instagram DM capture, spam filtering, opt-out tracking.
- **Email sequences** — scheduled or drip campaigns, tag-triggered, with open/click tracking and per-sequence unsubscribe.
- **Text blasts** — bulk SMS to a tag segment or a hand-picked list of contacts, with quiet-hours scheduling and a template picker.
- **Tasks** — per-contact follow-up reminders with due dates.
- **Today** — a daily worklist: overdue calls, new/uncontacted leads, replies owed, booking requests, tasks due.
- **Insights** — AI-flagged contact signals (Claude reads calls/texts/emails and suggests stage/timeline changes), a "warm right now" engagement ranking, lease-renewal and data-hygiene flags.
- **Sphere** — past-client/referral-source nurture: anniversaries, birthdays, going-quiet alerts, review requests.
- **Scheduling / booking** — a public Calendly-style booking page (`/book`) with its own availability rules, abandonment follow-up, and reminders.
- **Notes** — Granola meeting-transcript capture, matched to contacts, with AI-proposed field updates you approve one at a time.
- **Reports** — lead source, speed-to-lead, follow-up rate, stale leads, duplicate risk, sequence engagement, deal forecast — the generic reporting surface (no commission-cap or event-attendance reports).
- **Rate-move alerts** — a daily mortgage-rate feed (free FRED API) with an Insights card when the rate moves meaningfully. This is arguably more useful to a lender than it was to the original real-estate-agent app it came from.
- **Settings / auth shell** — magic-link sign-in, pipeline stage & tag management, integration connection cards, data-repair backfill buttons, push notifications.

### Integrations kept

Gmail (sync/send/sequences), Quo (call/text), Calendly (booking sync),
Granola (meeting notes), Instagram (DM capture), Blinq (business-card
capture), Anthropic/Claude (AI insights), web push.

## What's intentionally excluded, and why

The owner explicitly asked for "core CRM chassis only," excluding
real-estate-only features. Beyond that explicit list, the following
judgment calls were made (read this before you go looking for something
that's missing):

| Removed | Why |
|---|---|
| **PadSplit listing scraping, room-rental sync** | Explicitly excluded — a real-estate/room-rental-specific scraper. |
| **Listings / Offering Memorandum pages** (`app/listing`, `app/(app)/listings`, `lib/listings`, `components/listings`) | Explicitly excluded — public listing marketing pages, reverse-prospecting-to-other-agents (`listing_agents`, `agents`, `listing_sends` tables and all related code), OM underwriting pages. None of this applies to a lender. |
| **Reverse-prospecting-to-agents** | Explicitly excluded (same feature as above — cold outreach to other real-estate agents on a shared listing). |
| **Events / meetups** (`app/(app)/events`, `lib/crm/events*.ts`, Eventbrite + Jotform webhooks, in-person check-in kiosk) | The original owner co-organized two recurring meetups ("Women's REI," "House Hacking Atlanta"). Nothing here generalizes to a lender's business, so the whole events subsystem — event rosters, Eventbrite registration sync, Jotform kiosk check-in, event-reply reminders, event reports — is gone. |
| **Commission/cap tracking, agent recruiting** (`app/(app)/commissions`, `app/(app)/recruiting`, `lib/crm/commission.ts`) | A brokerage-specific (Keller Williams) commission-split/cap formula and an agent-recruiting pipeline. Not meaningful outside that brokerage structure. |
| **"House hack" loan/payment calculator** (`app/(app)/numbers`, `components/calculator`, `app/n/[slug]`, the `quotes`/`quote_views` tables) | A judgment call, not an explicit instruction. This tool computes a monthly-payment quote with an optional "rent from the other unit" offset and a shareable public link — genuinely closer to a lender's business than a real-estate agent's, and was tempting to keep. It was left out because (a) it's not on the explicit "core chassis" list, (b) its specific framing (house-hacking rent offsets, investor comparison) is real-estate-investment-specific, and (c) keeping it well would have meant a real rewrite rather than a drop-in. If you want this back, `lib/crm/house-hack-calc.ts` and `components/calculator/HouseHackCalculator.tsx` in the original repo are a reasonable starting point for a generic loan-payment calculator. |
| **Caitlyn's own marketing sites** (`components/public`, the `house-hacking-site` and `site-form` webhooks, the `callcaitlyn.com`/`colivingcait.com`-proxying rewrite rules in the old `next.config.mjs`) | Entirely specific to the original owner's separate marketing websites (nav/footer chrome, site-specific lead-form routing for named sites like "Atlanta Women Investors," "Women's Coliving Summit"). Nothing generic to carry over. |
| **`*.proof.ts` files and their `prove-*` npm scripts** | These were the original project's own regression-test harness, each one a characterization test for a specific past bug tied to the now-excluded features (or to copy/behavior too specific to carry over cleanly). Removed rather than left half-working; write your own tests as the chassis evolves. |

### Known limitation: the Dialer's two queues are event-shaped

The Dialer's two call queues (`lib/data/dialer.ts`: "event follow-up" and
"confirmation") were originally built to drive two meetup-specific
workflows — calling people after they attended a meetup, and confirming
attendance before one. The queries don't *import* anything excluded (they
query `contacts.last_event_at` / `event_confirmations` directly), so they
compile and run fine, but with no event feature feeding those columns
they'll simply stay empty for this chassis. Either wire your own source
into them (e.g. "call back N days after a loan closes") or remove the
Dialer's two tabs down to whatever queues you actually need —
`app/(app)/dialer/` and `lib/data/dialer.ts` are the two files to start
from. Everything else in the Dialer (the call UI, logging, templates) is
generic.

### Judgment calls worth knowing about

- **`lib/data/insights.ts`'s "registered and haven't heard from you" card** and the Dialer's "confirmation"/"event follow-up" queues all key off `contacts.last_event_name` / `last_event_at`, which nothing in this chassis populates anymore. Harmless (they just show nothing), but if you don't plan to use them, it's fine to strip them later.
- **The `deals` table still carries a handful of unused brokerage-specific columns** (`referral_pct`, `kw_fee`, `kwri_fee`, `fmls_fee`, `tc_fee`, `manual_split`, `misc_fee`, `oz_fee`) and **`contacts` carries a few unused agent-recruiting columns** (`recruit_stage`, `referral_fee`, `recruit_joined_at`, `recruit_fee_received_at`). These came from migrations that also touched the shared `deals`/`contacts` tables (a rename, a status column, a contact-type enum value), so the whole migration was kept rather than hand-splitting interdependent `ALTER TABLE` statements — see **Migrations** below. They're inert; `gross_commission` (a plain dollar figure, whatever you want it to represent — loan amount, fee, revenue) is the only deal field any kept code reads.
- **`contacts.company`** (a plain free-text field, populated by e.g. the Blinq integration) was kept from the otherwise-fully-excluded listings migration (`0069`), since it's a generic field with no listings dependency — see the migration file's own note.
- The **Calendly-style `/book` page** no longer wraps itself in the original app's marketing-site chrome (`components/public`, excluded) — it's now a minimal standalone page. Add your own header/footer there if you want one.
- The weekly-review email and a couple of report helpers still reference an `"eventbrite"` activity `source` value in a few read-only comparisons (e.g. a "double registration" check). Harmless no-ops now that nothing writes that source — not worth the risk of touching since they're narrow, self-contained conditionals.

## No secrets, anywhere

This export was built by copying only **git-tracked** files out of the
original repository (`git ls-files`), so no `.env` file, gitignored secret,
or local artifact could have come along. `.env.example` (committed, no real
values) is the only file that lists environment variable names. Grep the
tree yourself for anything that looks like a live key before you deploy, if
you want to double-check.

## Getting started

### 1. Create a Supabase project

1. [supabase.com](https://supabase.com) → create a new project.
2. **SQL Editor** → run every file in `supabase/migrations/` **in filename
   order** (0001, 0002, 0003, …) — see **Migrations** below for exactly
   what's in there and why it's not 0001–0084 anymore.
3. **Authentication → Providers**: enable **Email** (magic-link sign-in, no passwords).
4. **Authentication → URL Configuration**: set **Site URL** to your real domain, and add `https://your-domain.example.com/auth/confirm` (plus a `localhost:3000` version for local testing) to **Redirect URLs**.
5. **Authentication → Emails → Templates → Magic Link**: replace `{{ .ConfirmationURL }}` in the link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/` (this app verifies via `token_hash`, not the default PKCE `code` flow, so a magic link still works when opened in a different browser/app than the one that requested it).
6. **Project Settings → API**: copy the **Project URL** and **anon public** key.
7. (Recommended) Set up custom SMTP under **Authentication → Emails → SMTP Settings** — Supabase's built-in sender has a very low rate limit.

### 2. Configure environment variables

```
cp .env.example .env.local
```

Fill in at minimum `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
from step 1.6. Every other variable in `.env.example` is for one specific
integration (Quo, Gmail, Calendly, Granola, Instagram, Blinq, AI insights,
rate feed, push) and is commented with where to get it — add each one only
once you're setting up that integration. Nothing breaks by leaving them
unset; that integration just stays dormant.

### 3. Run it locally

```
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to
`/login`. Enter your email, open the magic link, and you're in. First
sign-in seeds your pipeline stages and starter tags automatically (see
`supabase/migrations/0001_init.sql`'s `handle_new_user` trigger).

### 4. Deploy to Vercel

1. Push this to your own GitHub repo.
2. [vercel.com](https://vercel.com) → **Add New Project** → import it.
3. Add your environment variables in the Vercel project settings.
4. Deploy, then add `https://your-app.vercel.app/auth/confirm` (and your custom domain's) to Supabase's redirect URLs.
5. `vercel.json` only schedules cron jobs — it does not touch Vercel's own Deployment Protection or Firewall settings, which live in the Vercel dashboard. If login or `/book` ever 403s with a Vercel-branded block page (not this app's own UI), that's Deployment Protection or the Firewall, not this code — check **Settings → Deployment Protection** (Production must stay public) and **Settings → Firewall**.

Gmail sync, sequence sends, text blasts, and reply reminders run every
15 minutes, and the prep sheet and booking reminders every 5 minutes
(`vercel.json`). That needs **Vercel Pro** — on the free Hobby plan the
deployment fails with a cron configuration error, because Hobby only
allows daily cron jobs.

## Migrations

The original app had 84 sequentially-numbered migrations. This chassis
ships **68** of them (`supabase/migrations/0001` … `0080`, with gaps —
filenames don't need to be contiguous, Supabase just applies them in
filename order).

**16 files were removed outright** because their entire content only
created or altered tables used exclusively by an excluded feature:
`0003` (seeds meetup-specific tags), `0043` (`quotes`/`quote_views` — the
house-hack calculator), `0049` (`agent_recruits`), `0068`/`0075` (the
`events` table and its cadence columns — confirmed nothing in this
chassis's kept code queries `events`), and `0070`–`0084`'s listings-only
files (`0070`–`0073`, `0076`–`0078`, `0081`–`0084` — storage policies,
Zillow/PadSplit/OM columns, listing status/activity tables, a one-shot
PadSplit data backfill).

**One file (`0069`, originally "Listings portal") was trimmed, not
removed**: the original created ~10 listings/reverse-prospecting tables
plus one unrelated `contacts.company` column. The listings tables are
gone; the `company` column — used by the kept Blinq integration — was
kept on its own, and the file renamed to `0069_contacts_company.sql` so
its name matches what it now does.

**Every other migration was kept as-is**, including several that add
columns to the shared `contacts`/`deals`/`activities` tables for a feature
this chassis doesn't use (commission math, agent recruiting, event
check-in source values). Splitting those out would mean hand-editing
`ALTER TABLE` statements that depend on column order and prior migrations
in ways that are easy to get subtly wrong — the explicit guidance for this
export was to keep the whole file rather than risk a broken schema, and
note it here instead. See **Judgment calls** above for exactly which
unused columns this leaves behind; none of it breaks anything, and a fresh
`supabase/migrations/0001` → last-file run applies cleanly in order on a
new project.

## Setting up Quo (calling/texting sync)

Logs every call and text from your Quo number onto the matching contact's
timeline, and lets you send texts from inside the CRM.

1. **Supabase user ID + service role key**: Authentication → Users → copy your UID (`CRM_OWNER_USER_ID`). Project Settings → API → copy the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`) — treat it like a password, it bypasses RLS.
2. **Quo API key**: Quo → Settings → API (requires Owner/Admin) → `QUO_API_KEY`.
3. **Register the webhook** via Quo's API (no dashboard button for this — see [quo.com/docs](https://www.quo.com/docs)) pointed at `https://your-domain.example.com/api/webhooks/quo`. The response includes a signing key → `QUO_WEBHOOK_SIGNING_KEY`.
4. Add all four env vars, redeploy, send yourself a test call/text, confirm it lands on the right contact.
5. Set `CRM_QUO_ENFORCE_SIGNATURE=true` once the signature format is confirmed against a real delivery.

If you ever run more than one number on the Quo account, set
`QUO_INCLUDED_PHONE_NUMBERS` (which numbers to pull in) and
`QUO_SEND_PHONE_NUMBER` (which one outbound texts send from) — see the
comments in `.env.example`.

## Setting up Calendly (booking sync)

1. Calendly → Integrations & API & Webhooks → generate a Personal Access Token → `CALENDLY_API_TOKEN`.
2. `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.calendly.com/users/me` → copy `current_organization`.
3. `POST https://api.calendly.com/webhook_subscriptions` with that token, `url: "https://your-domain.example.com/api/webhooks/calendly"`, `events: ["invitee.created", "invitee.canceled"]`, `organization`, `scope: "organization"`. The response includes a signing key → `CALENDLY_WEBHOOK_SIGNING_KEY`.
4. Add both env vars, redeploy, book a test appointment, confirm it lands on the right contact.
5. Set `CRM_CALENDLY_ENFORCE_SIGNATURE=true` once confirmed.

## Setting up Granola (meeting/note transcripts)

Granola transcribes video meetings, in-person notes, and phone calls; this
reads the transcript and proposes field/stage updates on the matched
contact's page for you to approve one at a time.

1. Pick a random secret string → `GRANOLA_WEBHOOK_SECRET`. Add it (and `APP_BASE_URL`) to Vercel, redeploy.
2. In Settings → Granola on the CRM itself, copy the webhook URL shown there (secret already baked in).
3. Paste that URL into Granola's own Settings → Integrations.
4. Generate a **Workspace** API key (not Personal — Granola's webhook only sends a thin "this note changed" ping, so this key fetches the real content) → `GRANOLA_API_KEY`.
5. Make sure notes land in a shared workspace space, not "My notes" — Granola's webhook only fires for shared-space notes.
6. Take a test meeting/note and confirm a proposed-changes panel shows up on the matching contact's page a little after.

## Setting up Instagram (DMs in the Messages inbox)

Requires an Instagram professional account connected to a Facebook Page,
and a Meta Developer App.

1. [developers.facebook.com](https://developers.facebook.com) → create/reuse an app, add the Instagram product.
2. App Settings → Basic → copy the App Secret → `META_APP_SECRET`.
3. Generate a long-lived Page Access Token with `instagram_manage_messages` → `META_PAGE_ACCESS_TOKEN`.
4. Pick a random string → `META_VERIFY_TOKEN`. Add all three plus `APP_BASE_URL`, redeploy.
5. Register a webhook subscription pointed at `https://your-domain.example.com/api/webhooks/instagram`, same string as Verify Token.
6. Subscribe to the `messages` field, send a real test DM, confirm it shows up as a "Stranger" row on Messages.

Leave all three unset and this stays dormant — Messages works fine without it.

## Setting up Blinq (digital business card capture)

**Free, default path**: Blinq emails a notification every time someone
shares their card back. The Gmail sync already recognizes that email and
parses name/phone/email out of it automatically — nothing to configure
beyond having Gmail sync connected (below).

**Blinq Business (optional)**, via Zapier's "Webhooks by Zapier" action: pick
a random string (`BLINQ_WEBHOOK_SECRET`), point a Zap at
`https://your-domain.example.com/api/webhooks/blinq?secret=YOUR_SECRET`,
map Blinq's fields (`email`, `phone`, `first_name`/`name`, `last_name`,
`company`, `job_title`, `blinq_contact_id`). Skip this whole section unless
you're already paying for Blinq Business.

## Setting up Gmail (sync, sending, and sequences)

1. [console.cloud.google.com](https://console.cloud.google.com) → create/use a project → enable the **Gmail API** and **Google Calendar API**.
2. OAuth consent screen → External, add scopes `gmail.readonly`, `gmail.send`, `userinfo.email`, `calendar.events`; add yourself as a test user while in Testing mode.
3. Credentials → OAuth client ID → Web application → Authorized redirect URI `https://your-domain.example.com/api/auth/gmail/callback` → copy Client ID/Secret.
4. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_BASE_URL`, and a random `CRON_SECRET`, redeploy.
5. In the app, **Settings → Connect Gmail**.

Inbound/outbound mail with existing contacts logs to their timeline
automatically; first sync doesn't backfill your pre-existing inbox.

## Email sequences

Two trigger types, picked per sequence, both driven off a tag:

- **Scheduled** — each step fires at a fixed date/time to whoever has the target tag at that moment.
- **Drip** — each contact starts their own clock the moment they get the tag; steps fire at a relative delay.

Create one from **Sequences**: name it, pick a type and target tag, add
steps with `{{first_name}}`/`{{last_name}}` merge fields, a live preview,
and a "send test to myself" button. Every send gets automatic open/click
tracking and an unsubscribe footer (including the RFC 8058 one-click
header).

## Setting up AI insights

1. API key at [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY`.
2. Redeploy. Text/call/email a contact and check their page for a suggestion card (apply/dismiss — nothing changes automatically).

## Setting up push notifications

Generate VAPID keys once with `npx web-push generate-vapid-keys` and never
regenerate them (existing subscribers would need to re-enable). Set
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
(a `mailto:` address).

## Project structure

```
app/(app)/                    Authenticated pages (Today, contacts, pipeline, dialer, messages, insights, sphere, notes, reports, sequences, scheduling, settings)
app/book/                     Public Calendly-style booking pages
app/login/, app/auth/confirm/ Magic-link sign-in
app/api/webhooks/             Quo, Calendly, Granola, Blinq, Instagram webhook receivers
app/api/auth/gmail/           Gmail OAuth connect/callback
app/api/cron/                 Vercel Cron: Gmail sync, sequence sends, text blasts, rate feed, reply reminders, booking reminders, prep sheet, auto-stage, weekly review
app/api/track/, app/api/unsubscribe/   Sequence email open/click tracking + unsubscribe
components/                   UI, nav, contacts, dashboard, dialer, messages, sequences, settings, insights, booking, calendar components
lib/brand/identity.ts         ← Business identity config. Edit this first.
lib/crm/                      Shared CRM logic: contact matching, activity logging, engagement tagging, sequence/text-blast sending, auto-stage automation
lib/data/                     Server-side Supabase queries
lib/supabase/                 Supabase client/server/middleware/admin helpers
lib/quo/, lib/calendly/, lib/google/, lib/instagram/, lib/granola/, lib/ai/   Integration-specific clients/parsers
lib/validation/                Zod schemas
supabase/migrations/           Database schema — run in order in Supabase's SQL Editor (see Migrations above)
types/database.ts              Hand-written types matching the schema
```
