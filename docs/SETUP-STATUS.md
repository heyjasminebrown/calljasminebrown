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

## Next: Eventbrite, step 3
1. Vercel → Deployments → the row with the blue **Production** badge → ⋯ → Redeploy
   (so the Eventbrite keys take effect). Wait for Ready.
2. In each Eventbrite account: profile → Account Settings → Developer Links → Webhooks →
   Add webhook
   - Payload URL: `https://www.calljasminebrown.com/api/webhooks/eventbrite?secret=YOURSECRET`
     (YOURSECRET = the `EVENTBRITE_WEBHOOK_SECRET` value)
   - Event: All events · Actions: `order.placed`, `attendee.checked_in`
3. Test: register for one of your own events with a free ticket. You should appear in
   Contacts within a minute, tagged with the event name.

## Later
- Quo calls/texts: retest once A2P verification is approved (text and call the Quo number,
  then check Messages). Quo keys and webhook are already set up.
