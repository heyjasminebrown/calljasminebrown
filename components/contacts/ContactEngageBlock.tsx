"use client";

import { useState } from "react";
import { EngageStrip } from "@/components/contacts/EngageStrip";
import { FollowUpBar } from "@/components/contacts/FollowUpBar";
import { LogSheet } from "@/components/contacts/mobile/LogSheet";
import { StageTagsSheet } from "@/components/contacts/mobile/StageTagsSheet";
import { QuickAddMenu } from "@/components/nav/QuickAddMenu";
import { fullName } from "@/lib/utils";
import type { ContactWithRelations, PipelineStage, Tag } from "@/types/database";

export function ContactEngageBlock({
  contact,
  stages,
  tags,
  ownerId,
  smsDraft,
}: {
  contact: ContactWithRelations;
  stages: PipelineStage[];
  tags: Tag[];
  ownerId: string;
  smsDraft?: string;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const name = fullName(contact);

  return (
    <div className="space-y-3">
      <EngageStrip
        contactId={contact.id}
        phone={contact.phone}
        email={contact.email}
        smsDraft={smsDraft}
        onNote={() => setLogOpen(true)}
        onTask={() => setTaskOpen(true)}
        onStage={() => setStageOpen(true)}
        sticky={false}
      />
      <FollowUpBar contactId={contact.id} nextFollowUpAt={contact.next_follow_up_at} />
      <StageTagsSheet
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        contactId={contact.id}
        ownerId={ownerId}
        currentStageId={contact.stage_id}
        stages={stages}
        tags={tags}
        currentTagIds={contact.contact_tags.filter((ct) => ct.tags).map((ct) => ct.tags!.id)}
        contactName={name}
        contactCreatedAt={contact.created_at}
        representing={contact.representing}
      />
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} ownerId={ownerId} contactId={contact.id} contactName={name} initialType="note" />
      {taskOpen && <QuickAddMenu initialMode="task" initialContactId={contact.id} onClose={() => setTaskOpen(false)} />}
    </div>
  );
}
