"use client";

import { useState } from "react";
import { ConversationRow } from "@/components/messages/ConversationRow";
import type { Conversation } from "@/lib/data/messages";

const INITIAL_COUNT = 3;

// Same cap pattern WorklistGroup uses elsewhere on Today - "Nothing owed"
// can genuinely run to hundreds of quiet threads, and rendering every one
// by default made this the longest list on the page for no reason: nothing
// here needs her attention right now.
export function NotOwedList({
  conversations,
  filter,
  hidden,
}: {
  conversations: Conversation[];
  filter?: string | null;
  hidden?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? conversations : conversations.slice(0, INITIAL_COUNT);
  const remaining = conversations.length - visible.length;

  return (
    <>
      {visible.map((c) => (
        <ConversationRow key={c.contact.id} conversation={c} filter={filter} hidden={hidden} />
      ))}
      {remaining > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="px-0.5 py-2 text-left text-[15px] font-semibold text-neutral-500">
          Show the rest ({remaining} more)
        </button>
      )}
    </>
  );
}
