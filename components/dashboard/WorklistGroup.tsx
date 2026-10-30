"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, MessageSquareText, Mail } from "lucide-react";
import { openQuoCall } from "@/lib/quo/call-link";
import { initials } from "@/lib/utils";
import { WorklistRowMenu, type WorklistMenuItem } from "@/components/dashboard/WorklistRowMenu";
import { SendEmailForm } from "@/components/contacts/SendEmailForm";
import { messageComposeHref } from "@/lib/crm/new-lead-text-templates";
import type { WorklistPerson } from "@/lib/data/today";

const CAP = 10;

const actionBtn =
  "flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white text-sm font-semibold text-neutral-800";

export function WorklistGroup({
  people,
  onDismiss,
  dismissLabel = "Dismiss",
  onDismissContact,
  dismissContactLabel = "Dismiss",
  onNeverQueue,
}: {
  people: WorklistPerson[];
  onDismiss?: (activityId: string) => Promise<{ ok: boolean }>;
  dismissLabel?: string;
  onDismissContact?: (contactId: string) => Promise<{ ok: boolean }>;
  dismissContactLabel?: string;
  onNeverQueue?: (contactId: string) => Promise<{ ok: boolean }>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [emailOpenId, setEmailOpenId] = useState<string | null>(null);

  const remaining = people.filter((p) => !dismissed.has(p.activityId ?? p.id));
  const visible = showAll ? remaining : remaining.slice(0, CAP);

  async function handleDismiss(activityId: string) {
    if (!onDismiss) return;
    setDismissing(activityId);
    const result = await onDismiss(activityId);
    setDismissing(null);
    if (result?.ok) {
      setDismissed((prev) => new Set(prev).add(activityId));
    }
  }

  async function handleDismissContact(contactId: string) {
    if (!onDismissContact) return;
    setDismissing(contactId);
    const result = await onDismissContact(contactId);
    setDismissing(null);
    if (result?.ok) {
      setDismissed((prev) => new Set(prev).add(contactId));
    }
  }

  async function handleNeverQueue(contactId: string) {
    if (!onNeverQueue) return;
    setDismissing(contactId);
    const result = await onNeverQueue(contactId);
    setDismissing(null);
    if (result?.ok) {
      setDismissed((prev) => new Set(prev).add(contactId));
    }
  }

  if (remaining.length === 0) {
    return <p className="px-4 py-6 text-[15px] text-neutral-400">Nothing here right now.</p>;
  }

  return (
    <div>
      {visible.map((person) => {
        const menuItems: WorklistMenuItem[] = [];
        if (onDismiss && person.activityId) {
          menuItems.push({
            label: dismissLabel,
            description: "Clears this thread from Today. A new inbound still shows up.",
            onClick: () => void handleDismiss(person.activityId!),
          });
        }
        if (onDismissContact && onNeverQueue) {
          menuItems.push(
            {
              label: "Not this time",
              description: "Comes back if they register again",
              onClick: () => void handleDismissContact(person.id),
            },
            {
              label: "Never queue this person",
              description: "I know them personally — keep them out of every queue. Undo from their profile.",
              onClick: () => void handleNeverQueue(person.id),
            },
          );
        } else if (onDismissContact) {
          menuItems.push({
            label: dismissContactLabel,
            onClick: () => void handleDismissContact(person.id),
          });
        }

        return (
          <div key={person.id} className="border-b border-neutral-100 last:border-b-0">
            <div className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[14px] font-semibold text-neutral-600">
                {initials(person.name.split(" ")[0] ?? "", person.name.split(" ").slice(1).join(" "))}
              </div>
              <Link href={`/contacts/${person.id}`} data-contact-open={person.id} className="min-w-0 flex-1 rounded-[10px] hover:bg-[#f7f1ea]">
                <p className="truncate text-[16px] font-semibold leading-5 text-neutral-900 sm:text-[17px] sm:leading-6">{person.name}</p>
                <p className={`truncate text-[14px] leading-5 sm:text-[15px] ${person.late ? "font-medium text-[#b91c1c]" : "text-neutral-500"}`}>
                  {person.meta}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-1.5">
                {person.phone ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openQuoCall(person.phone!)}
                      aria-label={`Call ${person.name}`}
                      data-today-control={`call-${person.id}`}
                      className={`${actionBtn} w-10 sm:w-auto sm:px-3`}
                    >
                      <Phone size={15} className="text-neutral-500" />
                      <span className="hidden sm:inline">Call</span>
                    </button>
                    <Link
                      href={messageComposeHref(person.id, person.smsDraft)}
                      aria-label={`Text ${person.name}`}
                      data-today-control={`text-${person.id}`}
                      className={`${actionBtn} w-10 sm:w-auto sm:px-3`}
                    >
                      <MessageSquareText size={15} className="text-neutral-500" />
                      <span className="hidden sm:inline">Text</span>
                    </Link>
                  </>
                ) : (
                  person.email && (
                    <button
                      type="button"
                      onClick={() => setEmailOpenId((v) => (v === person.id ? null : person.id))}
                      aria-label={`Email ${person.name}`}
                      className={`${actionBtn} px-3 ${emailOpenId === person.id ? "border-brand-300 bg-brand-50 text-brand-700" : ""}`}
                    >
                      <Mail size={15} className={emailOpenId === person.id ? "text-brand-600" : "text-neutral-500"} />
                      <span className="hidden sm:inline">Email</span>
                    </button>
                  )
                )}
                <WorklistRowMenu busy={dismissing === (person.activityId ?? person.id)} items={menuItems} />
              </div>
            </div>
            {emailOpenId === person.id && person.email && (
              <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5">
                <SendEmailForm contactId={person.id} email={person.email} />
              </div>
            )}
          </div>
        );
      })}
      {!showAll && remaining.length > CAP && (
        <button type="button" onClick={() => setShowAll(true)} className="w-full px-4 py-3.5 text-left text-[15px] font-semibold text-neutral-500">
          Show the rest ({remaining.length - CAP} more)
        </button>
      )}
    </div>
  );
}
