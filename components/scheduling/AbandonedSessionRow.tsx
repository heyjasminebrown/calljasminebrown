"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, MessageSquare, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { openQuoCall, openQuoText } from "@/lib/quo/call-link";
import { cancelAbandonedSession } from "@/app/(app)/scheduling/actions";
import { relativeTime, APP_TIMEZONE } from "@/lib/format-time";
import type { BookingRequestWithContact } from "@/lib/data/scheduling";

export function AbandonedSessionRow({ request }: { request: BookingRequestWithContact }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  const howFar = request.starts_at
    ? `Picked ${formatInTimeZone(request.starts_at, APP_TIMEZONE, "EEE, MMM d 'at' h:mm a")}, didn't finish`
    : "Only left name and phone";

  async function dismiss() {
    setDismissing(true);
    await cancelAbandonedSession(request.id);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
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
          {howFar} · {relativeTime(request.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={() => openQuoCall(request.visitor_phone)} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500">
          <Phone size={14} />
        </button>
        <button type="button" onClick={() => openQuoText(request.visitor_phone)} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500">
          <MessageSquare size={14} />
        </button>
        <button type="button" onClick={dismiss} disabled={dismissing} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-400 disabled:opacity-50">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
