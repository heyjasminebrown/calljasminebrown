import { listEventFollowupQueue, listConfirmationQueue } from "@/lib/data/dialer";
import { getDefaultDraftTemplate } from "@/lib/data/text-templates";
import { confirmationItemToDialerContact } from "@/lib/crm/dialer-mapping";
import { DialerWorkspace } from "@/components/dialer/DialerWorkspace";

export default async function DialerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const activeTab = tab === "confirm" ? "confirm" : "followup";

  const [{ contacts: followups, error: followupError }, { items: confirmations, events: confirmationEvents, error: confirmationError }, defaultDraftTemplate] =
    await Promise.all([listEventFollowupQueue(), listConfirmationQueue(), getDefaultDraftTemplate()]);

  const contacts = activeTab === "confirm" ? confirmations.map(confirmationItemToDialerContact) : followups;
  const error = activeTab === "confirm" ? confirmationError : followupError;
  const mode = activeTab === "confirm" ? "confirmation" : "event-followup";

  const emptyMessage =
    activeTab === "confirm"
      ? confirmationEvents.length === 0
        ? "Nothing happening in the next couple days to confirm."
        : "Everyone's confirmed."
      : "No one's waiting on a follow-up call.";

  return (
    <>
      {error && (
        <p className="mx-4 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t load this queue: {error}. This usually means a database migration hasn&apos;t been run yet — check with your developer.
        </p>
      )}
      <DialerWorkspace
        contacts={contacts}
        mode={mode}
        activeTab={activeTab}
        followupCount={followups.length}
        confirmCount={confirmations.length}
        confirmationEvents={confirmationEvents}
        defaultDraftTemplate={defaultDraftTemplate}
        emptyMessage={emptyMessage}
      />
    </>
  );
}
