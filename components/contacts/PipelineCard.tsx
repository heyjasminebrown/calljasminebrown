import Link from "next/link";
import { fullName, initials } from "@/lib/utils";
import { MoveToMenu } from "@/components/contacts/MoveToMenu";
import { getPipelineCardContext } from "@/lib/crm/pipeline-card-context";
import type { ContactWithRelations, PipelineStage } from "@/types/database";
import type { PipelineExtras, PipelinePendingDeal } from "@/lib/data/pipeline";

export function PipelineCard({
  contact,
  stage,
  stages,
  extras,
  dealOverride,
}: {
  contact: ContactWithRelations;
  stage: PipelineStage | undefined;
  stages: PipelineStage[];
  extras: PipelineExtras;
  dealOverride?: PipelinePendingDeal;
}) {
  const context = getPipelineCardContext(contact, stage, extras, dealOverride);

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-[#ebe9e7] bg-white p-3.5">
      <Link href={`/contacts/${contact.id}`} data-contact-open={contact.id} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
          {initials(contact.first_name, contact.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-[23px] text-neutral-900">{fullName(contact)}</p>
          {context.line && (
            <p className={`mt-0.5 truncate text-[15px] leading-[22px] ${context.quiet ? "font-semibold text-red-700" : "text-neutral-600"}`}>{context.line}</p>
          )}
        </div>
      </Link>
      <MoveToMenu
        contactId={contact.id}
        ownerId={contact.owner_id}
        currentStageId={contact.stage_id}
        stages={stages}
        contactName={fullName(contact)}
        contactCreatedAt={contact.created_at}
        representing={contact.representing}
      />
    </div>
  );
}
