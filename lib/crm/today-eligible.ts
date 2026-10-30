import { hasPlaceholderName } from "@/lib/crm/merge-fields";
import { isMissedCall } from "@/lib/crm/message-owed";
import { normalizePhone } from "@/lib/phone";
import type { Activity } from "@/types/database";

const QUO_AUTO_SOURCE = /^Quo \(auto-created/i;

export type TodayEligibilityContact = {
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  lead_source?: string | null;
  spam?: boolean;
  archived?: boolean;
};

// Quo auto-creates a contact with first_name = the phone number when an
// unknown caller hits the line. Those stubs are not CRM people. A realtor
// gets a pile of them every morning; they must never be Today's work queue.
export function isUnknownCallerContact(contact: TodayEligibilityContact): boolean {
  if (contact.last_name?.trim()) return false;
  return hasPlaceholderName(contact);
}

export function isQuoAutoCreatedStub(contact: TodayEligibilityContact): boolean {
  if (!isUnknownCallerContact(contact)) return false;
  const source = contact.lead_source?.trim() ?? "";
  if (!source) return true;
  return QUO_AUTO_SOURCE.test(source);
}

export function activityHasSpamReason(metadata: Record<string, unknown> | null | undefined): boolean {
  return typeof metadata?.spam_reason === "string" && metadata.spam_reason.length > 0;
}

export function isTodayWorkContact(contact: TodayEligibilityContact): boolean {
  if (contact.spam || contact.archived) return false;
  if (isQuoAutoCreatedStub(contact)) return false;
  return true;
}

// Missed calls from unknown/auto-created numbers (and anything already
// spam-flagged on the activity) are not "owed a reply" for Today or the
// Messages waiting badge. Real inbound texts from a stub can still count —
// a person who texted about a listing is a lead; a robocall is not.
export function isSpamLikeMissedCall(
  contact: TodayEligibilityContact,
  activity: Pick<Activity, "type" | "direction" | "metadata">,
  allowlistedPhones?: Set<string>,
): boolean {
  const phoneKey = normalizePhone(contact.phone);
  if (phoneKey && allowlistedPhones?.has(phoneKey)) return false;
  if (contact.spam) return true;
  if (activityHasSpamReason(activity.metadata)) return true;
  return isMissedCall(activity) && isUnknownCallerContact(contact);
}
