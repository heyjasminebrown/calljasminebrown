"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { cancelProposedTime } from "@/app/(app)/scheduling/actions";
import { APP_TIMEZONE } from "@/lib/format-time";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";

export function ProposedRequestRow({ request }: { request: BookingRequestWithContact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    const res = await cancelProposedTime(request.id);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
      <div className="flex items-start gap-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-6 text-neutral-900">
            {request.contact_id ? (
              <Link href={`/contacts/${request.contact_id}`} className="hover:underline">
                {request.contact_name || request.visitor_name}
              </Link>
            ) : (
              request.visitor_name
            )}
          </p>
          <p className="mt-0.5 truncate text-sm text-neutral-500">
            {request.proposed_starts_at && (
              <>Proposed {formatInTimeZone(request.proposed_starts_at, APP_TIMEZONE, "EEE, MMM d 'at' h:mm a")}</>
            )}{" "}
            · {request.visitor_phone}
          </p>
          <p className="mt-1 text-sm text-neutral-400">Waiting on their confirmation</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
        >
          {busy ? "…" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
