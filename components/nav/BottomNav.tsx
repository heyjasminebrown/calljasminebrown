"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MOBILE_NAV_ITEMS, isMorePath, type NavCounts } from "./nav-items";
import { MoreSheet } from "./MoreSheet";
import { countFor as countForCounts } from "@/lib/nav/countFor";
import { cn } from "@/lib/utils";

export function BottomNav({ counts = {}, userEmail }: { counts?: NavCounts; userEmail?: string | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const countFor = countForCounts(counts);
  const onSmsThread = /^\/messages\/[^/]+$/.test(pathname);

  return (
    <>
      <nav className={onSmsThread ? "hidden" : "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[#eadfd6] bg-[#f7f1ea]/95 backdrop-blur lg:hidden"}>
        <ul className="flex items-stretch justify-around">
          {MOBILE_NAV_ITEMS.map((item) => {
            if (item.kind === "more") {
              const moreActive = isMorePath(pathname);
              return (
                <li key="more" className="flex-1">
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className={cn(
                      "flex h-full min-h-[66px] w-full flex-col items-center justify-center py-2 text-[12.5px] font-medium active:bg-[#efe6dc]",
                      moreActive ? "font-semibold text-[#c45c4a]" : "text-neutral-400",
                    )}
                  >
                    <span
                      className={cn(
                        "flex min-w-[56px] flex-col items-center gap-[5px] rounded-[14px] px-2.5 py-1.5",
                        moreActive && "bg-[#f3e4dc]",
                      )}
                    >
                      <item.icon size={25} strokeWidth={moreActive ? 2.3 : 1.8} />
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            }

            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const count = countFor[item.href];
            const fillActive = item.href === "/" || item.href === "/contacts" || item.href === "/messages";

            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "relative flex h-full min-h-[66px] flex-col items-center justify-center gap-[5px] py-2 text-[12.5px] font-medium active:bg-[#efe6dc]",
                    active ? "font-semibold text-[#c45c4a]" : "text-neutral-400",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex min-w-[56px] flex-col items-center gap-[5px] rounded-[14px] px-2.5 py-1.5",
                      active && "bg-[#f3e4dc]",
                    )}
                  >
                    <item.icon
                      size={25}
                      strokeWidth={active ? 2.3 : 1.8}
                      className={active && fillActive ? "fill-current" : undefined}
                    />
                    {count && count.value > 0 && (
                      <span className="absolute right-0 top-0 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#c45c4a] px-1 text-[11px] font-semibold text-white">
                        {count.value}
                      </span>
                    )}
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} userEmail={userEmail} counts={counts} />
    </>
  );
}
