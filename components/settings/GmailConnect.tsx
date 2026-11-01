"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Mail, Check } from "lucide-react";
import { APP_NAME } from "@/lib/brand/identity";
import { syncGmailNow, type GmailSyncNowResult } from "@/app/(app)/settings/gmail-sync-actions";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in.",
  state_mismatch: "That connection attempt expired — try again.",
  no_refresh_token: `Google didn't grant lasting access. Go to myaccount.google.com/permissions, remove ${APP_NAME}, then try connecting again.`,
  exchange_failed: "Something went wrong connecting to Google — try again, or tell me the error and I'll dig in.",
};

export function GmailConnect({
  connectedEmail,
  errorCode,
}: {
  connectedEmail: string | null;
  errorCode?: string;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<GmailSyncNowResult | null>(null);

  async function handleSyncNow() {
    setSyncing(true);
    setSyncResult(null);
    const result = await syncGmailNow().catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }));
    setSyncing(false);
    setSyncResult(result);
    router.refresh();
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setDisconnectError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDisconnecting(false);
      setDisconnectError("Not signed in");
      return;
    }
    const { error } = await supabase.from("gmail_accounts").delete().eq("owner_id", user.id);
    setDisconnecting(false);
    if (error) {
      setDisconnectError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {connectedEmail ? (
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-emerald-700">
            <Check size={15} className="shrink-0" /> <span className="truncate">Connected as {connectedEmail}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </div>
      ) : (
        <a href="/api/auth/gmail/connect">
          <Button variant="secondary" size="sm">
            <Mail size={14} /> Connect Gmail
          </Button>
        </a>
      )}
      {errorCode && <p className="text-xs text-red-600">{ERROR_MESSAGES[errorCode] ?? `Connection error: ${errorCode}`}</p>}
      {disconnectError && <p className="text-xs text-red-600">Couldn&apos;t disconnect: {disconnectError}</p>}
      {syncResult && <SyncResultNote result={syncResult} />}
    </div>
  );
}

function SyncResultNote({ result }: { result: GmailSyncNowResult }) {
  if (!result.ok) return <p className="text-xs text-red-600">Sync failed: {result.error}</p>;
  if (result.skipped === "not_connected") return <p className="text-xs text-red-600">Sync failed: Gmail isn&apos;t connected - reconnect it.</p>;
  if (result.skipped) return <p className="text-xs text-neutral-500">Sync restarted ({result.skipped}). Try Sync now again in a minute.</p>;
  return (
    <div className="space-y-1 text-xs text-neutral-600">
      <p>
        {result.firstSync ? "First sync: checked the last 3 days. " : ""}
        Checked {result.checked} new email{result.checked === 1 ? "" : "s"}, logged {result.synced} on contacts.
      </p>
      {result.unmatchedSenders.length > 0 && (
        <p className="text-amber-700">
          Not logged because the sender isn&apos;t a contact&apos;s main or secondary email: {result.unmatchedSenders.join(", ")}
        </p>
      )}
    </div>
  );
}
