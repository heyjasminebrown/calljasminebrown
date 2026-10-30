"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { BottomSheet } from "@/components/mobile/BottomSheet";
import { ListRow } from "@/components/mobile/ListRow";

type ContactOption = { id: string; first_name: string; last_name: string; phone: string | null; email: string | null };

// Scoped to a lightweight in-memory name filter over contacts already on
// the page - no search backend exists anywhere in this app to build on,
// and the header button's job here is "find someone fast," not a
// full-text search product.
export function TodaySearch({ contacts, variant }: { contacts: ContactOption[]; variant?: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const showDesktopBar = variant !== "mobile";
  const showMobileButton = variant !== "desktop";

  const results = query.trim()
    ? contacts.filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20)
    : [];

  useEffect(() => {
    if (!showDesktopBar) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDesktopBar]);

  const desktopBar = (
    <div className={variant === "desktop" ? "relative w-full min-w-0 max-w-[16rem] shrink xl:max-w-sm" : "relative hidden w-full min-w-0 max-w-[16rem] shrink xl:block xl:max-w-sm"}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        placeholder="Search contacts..."
        aria-label="Search contacts"
        className="h-11 w-full rounded-full border border-[#eadfd6] bg-[#fffbf8] pl-10 pr-14 text-[15px] text-neutral-900 shadow-card placeholder:text-neutral-400"
      />
      <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#eadfd6] bg-white px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 sm:inline">
        ⌘K
      </kbd>
      {open && query.trim() && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(100%,24rem)] overflow-hidden rounded-[16px] border border-[#eadfd6] bg-[#fffbf8] shadow-card"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[14px] text-neutral-400">No matches</p>
          ) : (
            <div className="divide-y divide-[#eadfd6] max-h-80 overflow-y-auto">
              {results.map((c) => (
                <ListRow
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  avatar={{ firstName: c.first_name, lastName: c.last_name }}
                  name={`${c.first_name} ${c.last_name}`}
                  className="bg-[#fffbf8]"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const mobileButton = (
    <div className={variant === "mobile" ? undefined : "xl:hidden"}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#eadfd6] bg-[#fffbf8] text-neutral-500 shadow-card"
      >
        <Search size={19} />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Search">
        <div className="pb-4">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            className="mb-2 w-full rounded-[14px] border border-neutral-200 px-3.5 py-2.5 text-[16px] text-neutral-900"
          />
          <div className="divide-y divide-neutral-100">
            {results.map((c) => (
              <ListRow
                key={c.id}
                href={`/contacts/${c.id}`}
                avatar={{ firstName: c.first_name, lastName: c.last_name }}
                name={`${c.first_name} ${c.last_name}`}
              />
            ))}
          </div>
        </div>
      </BottomSheet>
    </div>
  );

  return (
    <>
      {showDesktopBar && desktopBar}
      {showMobileButton && mobileButton}
    </>
  );
}
