"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cancelAbandonedSession } from "@/app/(app)/scheduling/actions";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";
import { bookingCardName } from "@/lib/crm/today-v1";
import { threadHref } from "@/lib/crm/inbox-href";
import { relativeTime } from "@/lib/format-time";
import { cn, initials } from "@/lib/utils";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";

function nameParts(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? name, last: parts.slice(1).join(" ") };
}

export function TodayAbandonedBookingCard({ request }: { request: BookingRequestWithContact }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = bookingCardName(request.contact_name, request.visitor_name);
  const { first, last } = nameParts(name);
  const messageHref = request.contact_id ? threadHref(request.contact_id) : null;
  const detail = request.starts_at
    ? `Picked a time, didn't finish · ${relativeTime(request.created_at)}`
    : `Started a booking, didn't finish · ${relativeTime(request.created_at)}`;

  async function dismiss() {
    setBusy(true);
    setError("");
    const res = await cancelAbandonedSession(request.id);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <article
      data-today-home="abandoned-booking"
      data-booking-request={request.id}
      className={cn("flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:p-5", TODAY_CARD)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f3e4dc] font-serif text-[16px] font-semibold text-[#c45c4a] lg:h-12 lg:w-12">
          {initials(first, last)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold leading-6 text-neutral-900 lg:text-[17px]">
            {name} <span className="font-medium text-neutral-600">started a booking</span>
          </p>
          <p className="mt-0.5 text-[14px] text-neutral-500">{detail}</p>
          {error && <p className="mt-1 text-[13px] text-red-600">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {messageHref ? (
          <Link
            href={messageHref}
            data-today-control="abandoned-booking-message"
            className="inline-flex h-10 items-center rounded-xl bg-[#c45c4a] px-3.5 text-[13px] font-semibold text-white lg:h-11 lg:px-4 lg:text-[14px]"
          >
            Follow up
          </Link>
        ) : (
          <Link
            href="/scheduling"
            data-today-control="abandoned-booking-open"
            className="inline-flex h-10 items-center rounded-xl bg-[#c45c4a] px-3.5 text-[13px] font-semibold text-white lg:h-11 lg:px-4 lg:text-[14px]"
          >
            Open Bookings
          </Link>
        )}
        <button
          type="button"
          data-today-control="abandoned-booking-dismiss"
          onClick={() => void dismiss()}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl border border-[#eadfd6] bg-[#fffbf8] px-3.5 text-[13px] font-semibold text-neutral-800 disabled:opacity-50 lg:h-11 lg:px-4 lg:text-[14px]"
        >
          {busy ? "…" : "Dismiss"}
        </button>
      </div>
    </article>
  );
}
