"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { openQuoCall } from "@/lib/quo/call-link";
import { dismissLease } from "@/app/(app)/insights/actions";
import type { LeaseRow } from "@/lib/data/insights";

export function LeaseRows({ rows }: { rows: LeaseRow[] }) {
  return (
    <div>
      {rows.map((row) => (
        <LeaseRowItem key={`${row.contactId}:${row.leaseEndsAt}`} row={row} />
      ))}
    </div>
  );
}

function LeaseRowItem({ row }: { row: LeaseRow }) {
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  async function handleDismiss() {
    setBusy(true);
    await dismissLease(row.dismissKey, row.contactId);
    setBusy(false);
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3.5 border-b border-neutral-100 px-4 py-3.5 last:border-b-0">
      <Link href={`/contacts/${row.contactId}`} className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold leading-6 text-neutral-900">{row.name}</p>
        <p className="truncate text-[15px] leading-[22px] text-neutral-600">Lease ends in {row.month}</p>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {row.phone && (
          <button
            type="button"
            onClick={() => openQuoCall(row.phone!)}
            className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            <Phone size={15} className="text-neutral-500" /> Call
          </button>
        )}
        <button type="button" onClick={handleDismiss} disabled={busy} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-400 disabled:opacity-50">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
