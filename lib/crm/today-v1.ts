import { applyMergeFields } from "@/lib/crm/merge-fields";
import {
  firstTouchSourceChipLabel,
  firstTouchTemplate,
  type FirstTouchSignals,
} from "@/lib/crm/new-lead-text-templates";
import { APP_TIMEZONE, formatLocal } from "@/lib/format-time";
import { displayFullName } from "@/lib/utils";
import { fromZonedTime } from "date-fns-tz";
import type { NewLeadContact } from "@/lib/data/new-leads";
import type { WorklistTask } from "@/lib/data/today";

export type TextAndNextLead = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string | null;
  leadDate: string | null;
  sourceChip: string;
  draft: string;
  autoFillNote: string;
};

export function calendarDaysFromToday(iso: string, now = new Date()): number {
  const targetDay = formatLocal(iso, "yyyy-MM-dd");
  const todayDay = formatLocal(now, "yyyy-MM-dd");
  const target = fromZonedTime(`${targetDay}T12:00:00`, APP_TIMEZONE).getTime();
  const today = fromZonedTime(`${todayDay}T12:00:00`, APP_TIMEZONE).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function daysOutLabel(iso: string, now = new Date()): string {
  const days = calendarDaysFromToday(iso, now);
  if (days <= 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export function taskDueLabel(dueAt: string | null, now = new Date()): string | null {
  if (!dueAt) return null;
  const days = calendarDaysFromToday(dueAt, now);
  if (days <= 0) return "Today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export function leadAgeLabel(leadDate: string | null, now = new Date()): string {
  if (!leadDate) return "new";
  const minutes = Math.floor((now.getTime() - new Date(leadDate).getTime()) / 60_000);
  if (minutes < 1) return "new · just now";
  if (minutes < 60) return `new · ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `new · ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `new · ${days}d ago`;
}

export function buildTextAndNextLeads(contacts: NewLeadContact[]): TextAndNextLead[] {
  return contacts.map((c) => {
    const signals: FirstTouchSignals = {
      leadSource: c.lead_source,
      lastEventName: c.last_event_name,
      tagNames: c.tagNames,
    };
    const sourceChip = firstTouchSourceChipLabel(signals);
    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      name: displayFullName(c),
      phone: c.phone,
      leadDate: c.lead_date,
      sourceChip,
      draft: applyMergeFields(firstTouchTemplate(signals), {
        first_name: c.first_name,
        last_name: c.last_name,
      }),
      autoFillNote: `First message auto-filled from ${sourceChip}.`,
    };
  });
}

export function upcomingEventRows<T>(items: T[], cap = 2): T[] {
  return items.slice(0, cap);
}

export function openTasksForToday(tasks: WorklistTask[], cap = 8): WorklistTask[] {
  return tasks.slice(0, cap);
}

export function addCalendarDaysIso(iso: string, days: number): string {
  const day = formatLocal(iso, "yyyy-MM-dd");
  const noon = fromZonedTime(`${day}T12:00:00`, APP_TIMEZONE);
  return new Date(noon.getTime() + days * 86_400_000).toISOString();
}

export function bookingWindowLabel(startsAt: string | null | undefined, endsAt: string | null | undefined): string {
  if (!startsAt) return "Time TBD";
  const day = formatLocal(startsAt, "EEE");
  const startTime = formatLocal(startsAt, "h:mm");
  const startPeriod = formatLocal(startsAt, "a");
  if (!endsAt) return `${day} ${startTime} ${startPeriod}`;
  const endTime = formatLocal(endsAt, "h:mm");
  const endPeriod = formatLocal(endsAt, "a");
  if (startPeriod === endPeriod) return `${day} ${startTime}–${endTime} ${endPeriod}`;
  return `${day} ${startTime} ${startPeriod}–${endTime} ${endPeriod}`;
}

export function bookingCardName(contactName: string | null | undefined, visitorName: string | null | undefined): string {
  const name = (contactName || visitorName || "Someone").trim();
  return name || "Someone";
}
