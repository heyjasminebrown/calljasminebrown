"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearOptOut } from "@/app/(app)/contacts/consent-actions";
import { relativeTime } from "@/lib/format-time";

// Consent isn't tracked up front any more (she gave you their number -
// that's enough); opt-out is the one thing this still shows, since an
// explicit STOP is worth honoring regardless of how someone got in.
// Nothing renders at all for a contact who hasn't opted out.
export function ConsentStatus({ contactId, optedOutAt }: { contactId: string; optedOutAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!optedOutAt) return null;

  async function handleClear() {
    setBusy(true);
    await clearOptOut(contactId);
    setBusy(false);
    router.refresh();
  }

  return (
    <p className="mt-1.5 text-sm text-red-700">
      Opted out {relativeTime(optedOutAt)}.{" "}
      <button type="button" onClick={handleClear} disabled={busy} className="font-semibold underline disabled:opacity-50">
        Clear (they confirmed renewed permission)
      </button>
    </p>
  );
}
