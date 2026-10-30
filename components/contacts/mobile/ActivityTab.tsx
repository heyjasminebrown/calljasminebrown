"use client";

import { useState } from "react";
import { ActivityTimeline } from "@/components/contacts/ActivityTimeline";
import { LogSheet } from "@/components/contacts/mobile/LogSheet";
import { Button } from "@/components/ui";
import { Plus } from "lucide-react";
import type { Activity } from "@/types/database";

export function ActivityTab({ activities, contactId, contactName, ownerId }: { activities: Activity[]; contactId: string; contactName: string; ownerId: string }) {
  const [logOpen, setLogOpen] = useState(false);
  return (
    <div>
      <Button variant="secondary" size="sm" onClick={() => setLogOpen(true)} className="mb-3 w-full">
        <Plus size={16} /> Log activity
      </Button>
      <div className="rounded-[16px] border border-[#ebe9e7] bg-white">
        <ActivityTimeline activities={activities} />
      </div>
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} ownerId={ownerId} contactId={contactId} contactName={contactName} />
    </div>
  );
}
