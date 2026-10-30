"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { PRIMARY_NAV_ITEMS, moreNavItemsForSidebar, navItemIsActive, type NavCounts } from "./nav-items";
import { SignOutButton } from "./SignOutButton";
import { QuickAddMenu } from "./QuickAddMenu";
import { countFor as countForCounts } from "@/lib/nav/countFor";
import { cn } from "@/lib/utils";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { OWNER_HEADSHOT_SRC, OWNER_NAME } from "@/lib/brand/identity";

export type { NavCounts };

export function Sidebar({ userEmail, counts = {} }: { userEmail?: string | null; counts?: NavCounts }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const moreItems = moreNavItemsForSidebar();
  const moreActive = moreItems.some((item) => navItemIsActive(item.href, pathname, focus));
  const [moreOpen, setMoreOpen] = useState(true);
  const expanded = moreOpen || moreActive;

  const countFor = countForCounts(counts);

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#eadfd6] bg-[#f7f1ea] px-3 py-[22px] lg:flex">
      <div className="flex items-center gap-2.5 px-2.5 pb-[22px]">
        {/* Swap the file at OWNER_HEADSHOT_SRC (lib/brand/identity.ts) for
            your own headshot. A 1:1 object-cover + zoom keeps a square
            source image's face centered in the circle. */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-[#eadfd6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={OWNER_HEADSHOT_SRC}
            alt={OWNER_NAME}
            width={36}
            height={36}
            className="h-full w-full object-cover"
            style={{ transform: "scale(2.4)", transformOrigin: "center 16%" }}
          />
        </div>
        <div className="min-w-0">
          <BrandWordmark />
          {userEmail && <p className="mt-0.5 truncate text-sm text-neutral-400">{userEmail}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        className="mb-[22px] flex w-full items-center gap-2.5 rounded-[11px] bg-brand-600 px-3.5 py-3 text-[15px] font-semibold text-white"
      >
        <Plus size={17} /> Quick add
      </button>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        <div>
          <p className="mb-2 px-2.5 text-[11px] font-semibold uppercase tracking-[.08em] text-neutral-400">Daily</p>
          {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = navItemIsActive(href, pathname, focus);
            const count = countFor[href];
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-[11px] px-3 py-3 text-base font-medium",
                  active ? "bg-[#f3e4dc] font-semibold text-brand-800" : "text-neutral-700 hover:bg-[#efe6dc]/70",
                )}
              >
                <Icon size={19} className={active ? "text-brand-700" : "text-neutral-500"} />
                {label}
                {count && (
                  <span className={cn("ml-auto text-sm", count.waiting ? "font-semibold text-brand-600" : "text-neutral-400")}>
                    {count.value}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="mb-2 flex w-full items-center justify-between px-2.5 text-[11px] font-semibold uppercase tracking-[.08em] text-neutral-400"
          >
            More
            <ChevronDown size={14} className={cn("text-neutral-300 transition-transform", expanded ? "rotate-0" : "-rotate-90")} />
          </button>
          {expanded && (
            <div className="flex flex-col">
              {moreItems.map(({ href, label, icon: Icon, hint }) => {
                const active = navItemIsActive(href, pathname, focus);
                const count = countFor[href];
                return (
                  <Link
                    key={href}
                    href={href}
                    title={hint}
                    className={cn(
                      "flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[15px] font-medium",
                      active ? "bg-[#f3e4dc] font-semibold text-brand-800" : "text-neutral-700 hover:bg-[#efe6dc]/70",
                    )}
                  >
                    <Icon size={18} className={active ? "text-brand-700" : "text-neutral-500"} />
                    {label}
                    {count && (
                      <span className={cn("ml-auto text-sm", count.waiting ? "font-semibold text-brand-600" : "text-neutral-400")}>
                        {count.value}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-neutral-100 px-2.5 pt-4">
        <SignOutButton />
      </div>

      {quickAddOpen && <QuickAddMenu onClose={() => setQuickAddOpen(false)} />}
    </aside>
  );
}
