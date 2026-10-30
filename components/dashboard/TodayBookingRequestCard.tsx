"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { approveBooking } from "@/app/(app)/scheduling/actions";
import { ProposeNewTimeModal } from "@/components/scheduling/ProposeNewTimeModal";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";
import { bookingCardName, bookingWindowLabel } from "@/lib/crm/today-v1";
import { threadHref } from "@/lib/crm/inbox-href";
import { cn, initials } from "@/lib/utils";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";

function nameParts(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? name, last: parts.slice(1).join(" ") };
}

export function TodayBookingRequestCard({ request }: { request: BookingRequestWithContact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposing, setProposing] = useState(false);
  const name = bookingCardName(request.contact_name, request.visitor_name);
  const { first, last } = nameParts(name);
  const windowLabel = bookingWindowLabel(request.starts_at, request.ends_at);
  const messageHref = request.contact_id ? threadHref(request.contact_id) : null;

  async function approve() {
    setBusy(true);
    setError("");
    const res = await approveBooking(request.id);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <article
      data-today-home="booking-request"
      data-booking-request={request.id}
      className={cn("flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:p-5", TODAY_CARD)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3e4dc] font-serif text-[16px] font-semibold text-[#c45c4a] lg:h-12 lg:w-12">
          {initials(first, last)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold leading-6 text-neutral-900 lg:text-[17px]">
            {name} <span className="font-medium text-neutral-600">requested a call</span>
          </p>
          <p className="mt-0.5 text-[14px] text-neutral-500">{windowLabel}</p>
          {error && <p className="mt-1 text-[13px] text-red-600">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          data-today-control="booking-approve"
          onClick={() => void approve()}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl bg-[#c45c4a] px-3.5 text-[13px] font-semibold text-white disabled:opacity-50 lg:h-11 lg:px-4 lg:text-[14px]"
        >
          {busy ? "…" : "Approve"}
        </button>
        <button
          type="button"
          data-today-control="booking-propose"
          onClick={() => setProposing(true)}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl border border-[#eadfd6] bg-[#fffbf8] px-3.5 text-[13px] font-semibold text-neutral-800 disabled:opacity-50 lg:h-11 lg:px-4 lg:text-[14px]"
        >
          Propose time
        </button>
        {messageHref ? (
          <Link
            href={messageHref}
            data-today-control="booking-message"
            className="inline-flex h-10 items-center rounded-xl border border-[#eadfd6] bg-[#fffbf8] px-3.5 text-[13px] font-semibold text-neutral-800 lg:h-11 lg:px-4 lg:text-[14px]"
          >
            Message
          </Link>
        ) : (
          <span
            title="No contact on this request yet — open Bookings to follow up."
            data-today-control="booking-message-stub"
            className="inline-flex h-10 cursor-not-allowed items-center rounded-xl border border-[#eadfd6] bg-[#fffbf8] px-3.5 text-[13px] font-semibold text-neutral-400 lg:h-11 lg:px-4 lg:text-[14px]"
          >
            Message
          </span>
        )}
      </div>
      {proposing && (
        <ProposeNewTimeModal
          requestId={request.id}
          visitorName={name}
          onClose={() => setProposing(false)}
        />
      )}
    </article>
  );
}
