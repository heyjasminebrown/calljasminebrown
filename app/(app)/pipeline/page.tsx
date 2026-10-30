import Link from "next/link";
import { listContacts, listStages } from "@/lib/data/contacts";
import { PipelineBoard } from "@/components/contacts/PipelineBoard";
import { CountScopeNote } from "@/components/CountScopeNote";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const params = await searchParams;
  const [contacts, stages] = await Promise.all([listContacts({}), listStages()]);
  const activeStageIds = new Set(stages.filter((s) => !s.is_closed_won && !s.is_closed_lost && !s.is_trash).map((s) => s.id));
  const activeCount = contacts.filter((c) => c.stage_id && activeStageIds.has(c.stage_id)).length;

  return (
    <div>
      <div className="px-4 pt-6 pb-4 lg:px-8 lg:pt-8">
        <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em] text-neutral-900">Pipeline</h1>
        <p className="mt-1 text-[15px] leading-[22px] text-neutral-500">
          {activeCount} in active stages. Search everyone and lists live in{" "}
          <Link href="/contacts" className="font-medium text-brand-700 hover:underline">
            Contacts
          </Link>
          .
        </p>
        <CountScopeNote current="pipeline" />
      </div>
      <PipelineBoard stages={stages} contacts={contacts} openStageId={params.stage} />
    </div>
  );
}
