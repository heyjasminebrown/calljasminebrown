import { PipelineCard } from "@/components/contacts/PipelineCard";
import { PipelineMobileRow } from "@/components/contacts/mobile/PipelineMobileRow";
import { PipelineMoneyStrip } from "@/components/contacts/mobile/PipelineMoneyStrip";
import { StageJumpChips } from "@/components/contacts/mobile/StageJumpChips";
import { StickyGroupHeader } from "@/components/mobile/StickyGroupHeader";
import { Section } from "@/components/ui/Section";
import { getPipelineExtras } from "@/lib/data/pipeline";
import { formatCurrency } from "@/lib/utils";
import type { ContactWithRelations, PipelineStage } from "@/types/database";
import type { PipelinePendingDeal, PipelineExtras } from "@/lib/data/pipeline";

// A contact can be under contract on more than one deal at once (e.g.
// representing them as both buyer and seller) - Under Contract renders
// one row per deal instead of one row per contact so neither is silently
// hidden. Every other stage keeps a plain one-row-per-contact list.
function rowsForStage(stage: PipelineStage, items: ContactWithRelations[], extras: PipelineExtras) {
  if (!stage.is_under_contract) return items.map((contact) => ({ contact, deal: undefined as PipelinePendingDeal | undefined }));
  const rows = items.flatMap((contact) => {
    const deals = extras.pendingDealByContact[contact.id] ?? [];
    if (deals.length === 0) return [{ contact, deal: undefined as PipelinePendingDeal | undefined }];
    return deals.map((deal) => ({ contact, deal }));
  });
  // Soonest (and any already-overdue) closing date first - "which deals
  // are about to blow up" is the actual question this stage answers, not
  // whatever order contacts happened to load in. No date at all sorts
  // last, not first, since it's the least urgent case, not the most.
  return rows.sort((a, b) => {
    const aDate = a.deal?.expectedClosingDate ? new Date(a.deal.expectedClosingDate).getTime() : Infinity;
    const bDate = b.deal?.expectedClosingDate ? new Date(b.deal.expectedClosingDate).getTime() : Infinity;
    return aDate - bDate;
  });
}

// Stages ordered by closeness to money rather than pipeline sequence -
// Under Contract and Hot/Ready are the two she actually acts on day to
// day, so they open by default; everything else (including New Lead,
// which is high-volume but low-per-contact-urgency) stays collapsed
// until she wants it. One collapse mechanism (Section/useSectionOpen)
// for all 9 stages rather than two different ones for a "top 3" vs. "the
// rest" grouping - simpler, and every stage gets the same persisted
// open/closed state across visits. The mobile branch reuses the exact
// same useSectionOpen key via StickyGroupHeader, so open/closed state is
// shared between mobile and desktop views of the same page.
export async function PipelineBoard({
  stages,
  contacts,
  openStageId,
}: {
  stages: PipelineStage[];
  contacts: ContactWithRelations[];
  openStageId?: string;
}) {
  const byStage = new Map<string, ContactWithRelations[]>();
  for (const c of contacts) {
    if (!c.stage_id) continue;
    byStage.set(c.stage_id, [...(byStage.get(c.stage_id) ?? []), c]);
  }

  const extras = await getPipelineExtras(contacts, stages);

  const underContractStage = stages.find((s) => s.is_under_contract);
  const hotStage = stages.find((s) => s.name.toLowerCase().includes("hot"));
  const newLeadStage = stages.find((s) => s.name.toLowerCase().includes("new lead"));

  const featured = [underContractStage, hotStage, newLeadStage].filter((s): s is PipelineStage => !!s);
  const featuredIds = new Set(featured.map((s) => s.id));
  const rest = stages.filter((s) => !featuredIds.has(s.id));
  const ordered = [...featured, ...rest];

  function summaryFor(stage: PipelineStage, items: ContactWithRelations[]): { text: string; quiet: boolean } | null {
    if (stage.is_under_contract) {
      const total = items.reduce((sum, c) => sum + (extras.pendingDealByContact[c.id] ?? []).reduce((s, d) => s + d.netCommission, 0), 0);
      return total > 0 ? { text: `${formatCurrency(total)} projected`, quiet: false } : null;
    }
    if (stage.id === hotStage?.id) {
      const goneQuiet = items.filter((c) => extras.coldFromHotIds[c.id]).length;
      return goneQuiet > 0 ? { text: `${goneQuiet} gone quiet 30+ days`, quiet: true } : null;
    }
    if (stage.id === newLeadStage?.id) {
      const noContact = items.filter((c) => extras.noContactIds[c.id]).length;
      return noContact > 0 ? { text: `${noContact} not yet contacted`, quiet: false } : null;
    }
    return null;
  }

  const underContractItems = underContractStage ? byStage.get(underContractStage.id) ?? [] : [];
  const underContractTotal = underContractItems.reduce(
    (sum, c) => sum + (extras.pendingDealByContact[c.id] ?? []).reduce((s, d) => s + d.netCommission, 0),
    0,
  );
  const hotItems = hotStage ? byStage.get(hotStage.id) ?? [] : [];
  const goneQuietCount = hotItems.filter((c) => extras.coldFromHotIds[c.id]).length;
  const newLeadItems = newLeadStage ? byStage.get(newLeadStage.id) ?? [] : [];
  const noContactCount = newLeadItems.filter((c) => extras.noContactIds[c.id]).length;

  return (
    <div>
      <PipelineMoneyStrip
        underContractTotal={underContractTotal}
        hotCount={hotItems.length}
        goneQuietCount={goneQuietCount}
        noContactCount={noContactCount}
      />
      <StageJumpChips stages={ordered.map((s) => ({ ...s, count: rowsForStage(s, byStage.get(s.id) ?? [], extras).length }))} />

      <div className="space-y-3 px-4 pb-8 lg:px-8">
        {ordered.map((stage) => {
          const items = byStage.get(stage.id) ?? [];
          const rows = rowsForStage(stage, items, extras);
          const summary = summaryFor(stage, items);
          const defaultOpen = stage.id === underContractStage?.id || stage.id === hotStage?.id;
          return (
            <div key={stage.id} id={`pipeline-stage-${stage.id}`} style={{ scrollMarginTop: 130 }}>
              {/* Mobile: StickyGroupHeader + plain rows */}
              <div className="rounded-[16px] border border-[#ebe9e7] bg-white lg:hidden">
                <StickyGroupHeader
                  label={stage.name}
                  count={rows.length}
                  summary={summary?.text}
                  summaryTone={summary?.quiet ? "danger" : "default"}
                  collapsible
                  sectionKey={`pipeline:stage:${stage.id}`}
                  defaultOpen={defaultOpen}
                >
                  <div className="divide-y divide-neutral-100">
                    {rows.length === 0 ? (
                      <p className="py-4 text-center text-sm text-neutral-400">Nobody in this stage.</p>
                    ) : (
                      rows.map(({ contact, deal }) => (
                        <PipelineMobileRow key={deal ? `${contact.id}:${deal.id}` : contact.id} contact={contact} stage={stage} extras={extras} dealOverride={deal} />
                      ))
                    )}
                  </div>
                </StickyGroupHeader>
              </div>

              {/* Desktop: unchanged Section + PipelineCard */}
              <div className="hidden lg:block">
                <Section
                  sectionKey={`pipeline:stage:${stage.id}`}
                  title={stage.name}
                  meta={`${rows.length}`}
                  defaultOpen={defaultOpen}
                  forceOpen={openStageId ? stage.id === openStageId : undefined}
                  action={
                    summary ? (
                      <span className={`shrink-0 text-[15px] font-semibold ${summary.quiet ? "text-red-700" : "text-neutral-600"}`}>{summary.text}</span>
                    ) : undefined
                  }
                >
                  <div className="space-y-2 bg-[#fcfbfa] p-3.5">
                    {rows.length === 0 ? (
                      <p className="py-4 text-center text-sm text-neutral-400">Nobody in this stage.</p>
                    ) : (
                      rows.map(({ contact, deal }) => (
                        <PipelineCard key={deal ? `${contact.id}:${deal.id}` : contact.id} contact={contact} stage={stage} stages={stages} extras={extras} dealOverride={deal} />
                      ))
                    )}
                  </div>
                </Section>
              </div>
            </div>
          );
        })}
        <p className="hidden px-0.5 pt-2 text-[15px] leading-[22px] text-neutral-500 lg:block">
          Stages are ordered by how close they are to money, not by pipeline order — the two you act on sit at the top, the rest stay shut until you want
          them.
        </p>
      </div>
    </div>
  );
}
