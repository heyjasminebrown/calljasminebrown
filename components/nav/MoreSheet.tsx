"use client";

import Link from "next/link";
import { BottomSheet } from "@/components/mobile/BottomSheet";
import { moreNavItemsForSheet, type NavCounts } from "@/components/nav/nav-items";
import { countFor as countForCounts } from "@/lib/nav/countFor";

// Flat More sheet: Events, Campaigns, Listings, Commissions, Reports,
// Settings. Bookings stays off nav (history is undesigned). Lists is not
// a nav destination.
export function MoreSheet({ open, onClose, counts }: { open: boolean; onClose: () => void; userEmail?: string | null; counts: NavCounts }) {
  const countFor = countForCounts(counts);
  const items = moreNavItemsForSheet();

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="pb-2">
        {items.map(({ href, label, icon: Icon }) => {
          const count = countFor[href];
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex min-h-[52px] items-center gap-3.5 border-b border-neutral-100 px-1 py-3 last:border-b-0 active:bg-neutral-50"
            >
              <Icon size={20} className="shrink-0 text-[#c45c4a]" />
              <span className="flex-1 text-[17px] font-medium text-neutral-900">{label}</span>
              {count && (
                <span className={count.waiting ? "text-[15px] font-semibold text-brand-600" : "text-[15px] text-neutral-400"}>
                  {count.value}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </BottomSheet>
  );
}
