import type { ConfirmationQueueItem, DialerContact } from "@/lib/data/dialer";

// Maps a (contact, event) confirmation row onto DialerCallModal/PersonCard's
// existing DialerContact shape so the same card - Call/Text/Reclassify/
// Dismiss, now with a "confirmation" mode - works for all three queues
// instead of needing its own copy. Deliberately its own module (no
// Supabase import) rather than living in lib/data/dialer.ts: that file
// imports the server-only Supabase client, and this function is called
// directly from client components (ConfirmationQueue, and eventually its
// mobile equivalent) - importing it from there would pull that server-only
// import into the client bundle.
export function confirmationItemToDialerContact(item: ConfirmationQueueItem): DialerContact {
  return {
    id: item.id,
    first_name: item.first_name,
    last_name: item.last_name,
    phone: item.phone,
    lead_source: null,
    last_event_name: null,
    last_event_at: null,
    created_at: "",
    dialer_snoozed_at: item.confirmationSnoozedAt,
    stage_id: item.stage_id,
    registrationLabel: item.eventName,
    registrationAccount: item.eventAccount,
    confirmationEventId: item.eventId,
    confirmationEventStart: item.eventStart,
    confirmationSource: item.source,
  };
}
