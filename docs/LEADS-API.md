# Leads API (website sign-ups -> CRM contacts)

`POST https://www.calljasminebrown.com/api/leads`

Call it from the website's **server** (e.g. the /conference server action), never from the
browser: it needs a secret.

Headers:
- `Content-Type: application/json`
- `Authorization: Bearer <LEADS_API_SECRET>` - the same value saved as `LEADS_API_SECRET` in
  **both** Vercel projects (CRM and website).

Body:

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "phone": "(404) 555-1234",
  "source": "Conference",
  "tags": ["Conference"],
  "form": "heyjasminebrown.com/conference"
}
```

- Required: `firstName`, `email`. Optional: `lastName`, `phone`, `source` (the new contact's
  Source; default "Website"), `tags` (up to 10, created if new), `form` (shown on the
  contact's timeline as "Signed up on <form>").

What the CRM does:
- If the email is already in the CRM (any contact's primary or secondary email, archived
  contacts included, case-insensitive), nothing changes: `200 { ok: true, created: false }`.
- Otherwise it creates the contact as **Type Community, Stage Warm**, adds the tags, logs
  "Signed up on <form>" on the timeline: `200 { ok: true, created: true, contactId }`.

Errors: `400` bad input, `401` wrong/missing secret, `500`/`503` CRM problem (also shown on the
CRM's error banner). A CRM failure shouldn't block the visitor's sign-up: keep the website's
own save/email and treat this call as best-effort.
