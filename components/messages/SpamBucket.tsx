"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { archiveAllSpam } from "@/app/(app)/messages/spam-actions";
import { SpamRow } from "@/components/messages/SpamRow";
import { inboxHref } from "@/lib/crm/inbox-href";
import type { Conversation } from "@/lib/data/messages";

// Desktop's dedicated view for ?spam=1. Mobile handles spam differently -
// an inline collapsible group at the bottom of InboxMobile, not a separate
// page - since a full-page navigation for a "glance and clear" bucket
// doesn't fit the phone's one-screen inbox the same way.
export function SpamBucket({ conversations }: { conversations: Conversation[] }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  async function handleClearAll() {
    setClearing(true);
    setError("");
    const result = await archiveAllSpam();
    setClearing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-4 pt-6 pb-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">Spam</h1>
          <p className="mt-0.5 text-[15px] leading-[22px] text-neutral-600">
            {conversations.length} calls filed automatically. Nothing here has touched your pipeline or your metrics.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={clearing || conversations.length === 0}
          className="flex shrink-0 items-center gap-2 rounded-[10px] bg-neutral-900 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Archive size={15} /> {clearing ? "Clearing…" : `Clear all ${conversations.length}`}
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-4">
        <Link href={inboxHref()} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft size={14} /> Back to inbox
        </Link>
        <Link href="/settings" className="text-sm text-neutral-500 hover:underline">
          Rules live in Settings → Spam filters
        </Link>
      </div>

      {error && <p className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Couldn&apos;t clear those: {error}</p>}

      <div className="space-y-2 px-4 pb-4">
        {conversations.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">Nothing filed as spam right now.</p>
        ) : (
          conversations.map((c) => <SpamRow key={c.contact.id} conversation={c} />)
        )}
        <p className="px-0.5 pt-2 text-sm leading-5 text-neutral-400">
          Deleting archives the auto-created contact and its call - recoverable from Hidden for 30 days. &quot;Not spam&quot; moves the call
          back into the inbox and stops that rule matching that number again.
        </p>
      </div>
    </div>
  );
}
