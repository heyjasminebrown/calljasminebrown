import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";
import { daysOutLabel } from "@/lib/crm/today-v1";
import { cn } from "@/lib/utils";
import { formatLocal } from "@/lib/format-time";
import type { TodayCalendarItem } from "@/lib/data/today";

export function TodayUpcomingEvents({ items }: { items: TodayCalendarItem[] }) {
  if (items.length === 0) return null;

  return (
    <section data-today-home="events" className="h-full min-w-0">
      <div className={cn("flex h-full flex-col overflow-hidden", TODAY_CARD)}>
        <p className="flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold text-neutral-800 sm:px-5">
          <Calendar size={16} strokeWidth={1.7} className="text-[#34223a]" />
          Upcoming Meetings
        </p>
        <div className="mt-1 flex-1">
          {items.map((item, i) => {
            const registered =
              typeof item.registeredCount === "number" ? `${item.registeredCount} registered` : null;
            return (
              <div
                key={item.id}
                className={cn("flex items-center gap-3.5 px-4 py-3.5 sm:px-5", i > 0 && "border-t border-[#ddd7da]/80")}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#f5e6dc] text-[#34223a]">
                  <Calendar size={18} strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">{item.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-400">
                    {[daysOutLabel(item.startsAt), formatLocal(item.startsAt, "h:mm a"), item.meta, registered].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {item.meetLink && (
                  <a href={item.meetLink} target="_blank" rel="noreferrer" className="shrink-0 text-[13px] font-medium text-[#34223a]">
                    Join
                  </a>
                )}
                <Link href={item.href} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-[#34223a]">
                  View
                  <ChevronRight size={15} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
