"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { approveBooking } from "@/app/(app)/scheduling/actions";
import { ProposeNewTimeModal } from "@/components/scheduling/ProposeNewTimeModal";
import { BOOKING_CONTACT_TYPE_OPTIONS } from "@/lib/crm/booking-form-options";
import { TIMELINE_LABELS } from "@/lib/utils";
import { APP_TIMEZONE } from "@/lib/format-time";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";

export function BookingRequestRow({ request }: { request: BookingRequestWithContact }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | null>(null);
  const [error, setError] = useState("");
  const [proposing, setProposing] = useState(false);

  async function approve() {
    setBusy("approve");
    setError("");
    const res = await approveBooking(request.id);
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  const contactTypeLabel = BOOKING_CONTACT_TYPE_OPTIONS.find((o) => o.value === request.contact_type)?.label;
  const hasDetails = Boolean(contactTypeLabel || request.timeline || request.questions);

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
            {request.starts_at && formatInTimeZone(request.starts_at, APP_TIMEZONE, "EEE, MMM d 'at' h:mm a")} · {request.visitor_phone}
            {request.visitor_email ? ` · ${request.visitor_email}` : ""}
          </p>
          {(contactTypeLabel || request.timeline) && (
            <p className="mt-1 text-sm text-neutral-600">
              {[contactTypeLabel, request.timeline ? TIMELINE_LABELS[request.timeline] : null].filter(Boolean).join(" · ")}
            </p>
          )}
          {request.questions && (
            <p className="mt-1 text-sm text-neutral-600">
              <span className="font-medium text-neutral-500">Questions:</span> {request.questions}
            </p>
          )}
          {!hasDetails && <p className="mt-1 text-sm italic text-neutral-400">No additional details provided.</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setProposing(true)}
            disabled={busy !== null}
            className="rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={busy !== null}
            className="rounded-[10px] bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "approve" ? "…" : "Approve"}
          </button>
        </div>
      </div>
      {proposing && (
        <ProposeNewTimeModal
          requestId={request.id}
          visitorName={request.contact_name || request.visitor_name}
          onClose={() => setProposing(false)}
        />
      )}
    </div>
  );
}
