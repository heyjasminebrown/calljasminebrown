# Booking API (for heyjasminebrown.com/meet)

The CRM (https://www.calljasminebrown.com) does the checking and booking. A booking page on
the website only needs these two calls. Both are public, return JSON, and accept browser
calls from `https://heyjasminebrown.com` and `https://www.heyjasminebrown.com`. Add more
origins (for example `http://localhost:3000` while developing) in the CRM's Vercel env var
`BOOKING_API_ALLOWED_ORIGINS` (comma-separated). Server-side calls need no CORS.

All times are ISO 8601 in UTC. Show them in `America/New_York` (Jasmine's calendar is ET).

## 1. Open times

`GET https://www.calljasminebrown.com/api/booking/availability?calendar=<link>`

- `calendar` is optional. Leave it out for her main calendar (what `/meet` should show);
  `/meet/<link>` should pass `<link>`.
- Busy time from her Google Calendar and her Outlook work calendar, buffers, minimum notice
  and booking window are already applied: every slot returned is bookable.

```json
{
  "ok": true,
  "timezone": "America/New_York",
  "calendar": { "slug": "intro-call", "name": "Intro call", "description": null, "durationMinutes": 20 },
  "calendars": [ { "slug": "intro-call", "name": "Intro call", "description": null, "durationMinutes": 20 } ],
  "slots": [ { "startAt": "2026-11-05T15:00:00.000Z", "endAt": "2026-11-05T15:20:00.000Z" } ]
}
```

`calendars` lists every active calendar (to offer a choice when `/meet` has more than one).
Errors: `404 { ok: false, error }` unknown or paused calendar; `500 { ok: false, error }`.
Don't cache this response; fetch it when the page opens.

## 2. Book a time

`POST https://www.calljasminebrown.com/api/booking/book` with `Content-Type: application/json`

```json
{
  "calendar": "intro-call",
  "startsAt": "2026-11-05T15:00:00.000Z",
  "name": "Jane Doe",
  "phone": "(404) 555-1234",
  "email": "jane@example.com",
  "topic": "Refinancing my rental",
  "source": "Website",
  "website": ""
}
```

- Required: `name`, `phone`, `email`, `startsAt` (send a `startAt` exactly as the
  availability call returned it). `calendar` optional (main calendar).
- `topic` optional (max 2000 chars). `source` optional: the Source for a **new** contact
  (default "Website"; e.g. "Get a Quote"). Existing contacts keep theirs.
- `website` is a honeypot: render it as a hidden field and send it empty. If it's filled the
  request pretends to succeed and books nothing.

Meetings are **phone calls** (Jasmine calls them at the number they give; no video link).

What the CRM does: finds or creates the contact, re-checks the time, creates the Google
Calendar event (location "Phone call: <their number>"), emails the invite to the guest and to her Outlook
(jbrown@cvlending.com), logs the meeting on the contact, texts a confirmation, notifies her.

Responses:

| Status | Body | Show the visitor |
|---|---|---|
| 200 | `{ ok: true, confirmed: true, startsAt, endsAt, calendar }` | "You're booked - Jasmine will call you at <phone>" - invite on its way to their email, text confirmation coming |
| 200 | `{ ok: true, confirmed: false, ... }` | "Request received - Jasmine will confirm shortly" (Google refused; she approves it in the CRM) |
| 400 | `{ ok: false, error }` | `error` (missing/invalid field) |
| 404 | `{ ok: false, error }` | `error` (calendar paused or unknown) |
| 409 | `{ ok: false, error, taken: true }` | `error`, then reload open times so they can pick again |
| 500 / 503 | `{ ok: false, error }` | `error` |

Each `error` is already written for the visitor.
