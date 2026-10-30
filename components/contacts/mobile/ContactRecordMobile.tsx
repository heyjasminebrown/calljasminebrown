"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Plus, Leaf, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/ui";
import { QuickActions } from "@/components/contacts/QuickActions";
import { MergeContactButton } from "@/components/contacts/MergeContactButton";
import { ArchiveButton } from "@/components/contacts/ArchiveButton";
import { StageTagsSheet } from "@/components/contacts/mobile/StageTagsSheet";
import { LogSheet } from "@/components/contacts/mobile/LogSheet";
import { OverviewTab } from "@/components/contacts/mobile/OverviewTab";
import { ActivityTab } from "@/components/contacts/mobile/ActivityTab";
import { DealsTab } from "@/components/contacts/mobile/DealsTab";
import { EngageStrip } from "@/components/contacts/EngageStrip";
import { FollowUpBar } from "@/components/contacts/FollowUpBar";
import { QuickAddMenu } from "@/components/nav/QuickAddMenu";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { formatPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Activity, AiInsight, ContactWithRelations, Deal, PipelineStage, Tag, TextTemplate } from "@/types/database";
import type { MergeCandidate } from "@/lib/data/contacts";

type Tab = "overview" | "activity" | "deals";

export function ContactRecordMobile({
  contact,
  stages,
  tags,
  activities,
  deals,
  insights,
  mergeCandidates,
  textTemplates,
  ownerId,
  textsThisWeek,
  openTasks,
  smsDraft,
}: {
  contact: ContactWithRelations;
  stages: PipelineStage[];
  tags: Tag[];
  activities: Activity[];
  deals: Deal[];
  insights: AiInsight[];
  mergeCandidates: MergeCandidate[];
  textTemplates: TextTemplate[];
  ownerId: string;
  textsThisWeek: number;
  openTasks: { id: string; title: string; due_at: string | null }[];
  smsDraft?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(activities.length > 0 ? "activity" : "overview");
  const [stageSheetOpen, setStageSheetOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState<"note" | "call">("note");
  const [taskOpen, setTaskOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const name = `${contact.first_name} ${contact.last_name}`.trim();
  const stage = stages.find((s) => s.id === contact.stage_id);
  const engagedTag = contact.contact_tags.find((ct) => ct.tags?.name === "Engaged");

  const activeActivities = activities.filter((a) => !!a.contact_id);
  const lastText = activities.find((a) => a.type === "text" && a.body);
  const lastExchange = lastText ? { body: lastText.body ?? "", occurred_at: lastText.occurred_at } : null;

  return (
    <div className="pb-4 lg:hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={() => router.back()} className="flex h-12 w-12 items-center justify-center rounded-full text-neutral-600">
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-1">
          <MergeContactButton contactId={contact.id} contactName={name} candidates={mergeCandidates} />
          <ArchiveButton contactId={contact.id} archived={contact.archived} />
        </div>
      </div>

      <div className="px-4 pb-2 text-center">
        <BrandWordmark size="sm" className="inline-block" />
      </div>

      <div className="px-4">
        <div className="flex items-start gap-3.5">
          <Avatar firstName={contact.first_name} lastName={contact.last_name} size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-neutral-900">{name}</p>
            <p className="mt-1.5 text-[15px] text-neutral-500">
              {[formatPhone(contact.phone), contact.representing ? `${contact.representing} side` : null].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStageSheetOpen(true)}
            className="flex h-[36px] items-center gap-1.5 rounded-full bg-[#f3e4dc] px-3 text-[14px] font-medium text-brand-700"
          >
            <Leaf size={14} strokeWidth={2} />
            {stage?.name ?? "No stage"}
          </button>
          {contact.lead_source && (
            <span className="flex h-[36px] items-center gap-1.5 rounded-full border border-[#eadfd6] bg-[#fffbf8] px-3 text-[14px] font-medium text-neutral-600">
              <CalendarDays size={14} strokeWidth={1.8} className="text-brand-700" />
              Source: {contact.lead_source}
            </span>
          )}
          {engagedTag && (
            <span className="flex h-[36px] items-center rounded-full border border-neutral-200 px-3 text-[14px] font-medium text-neutral-600">
              Engaged · {textsThisWeek} text{textsThisWeek === 1 ? "" : "s"} this week
            </span>
          )}
          {contact.contact_tags
            .filter((ct) => ct.tags && ct.tags.name !== "Engaged")
            .map((ct) => (
              <span
                key={ct.tags!.id}
                className="flex h-[36px] items-center rounded-full px-3 text-[14px] font-medium text-white"
                style={{ backgroundColor: ct.tags!.color }}
              >
                {ct.tags!.name}
              </span>
            ))}
          <button
            type="button"
            onClick={() => setStageSheetOpen(true)}
            className="flex h-[36px] items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 text-[14px] font-medium text-neutral-500"
          >
            <Plus size={14} /> Tag
          </button>
        </div>

        <div className="mt-3">
          <EngageStrip
            contactId={contact.id}
            phone={contact.phone}
            email={contact.email}
            smsDraft={smsDraft}
            onNote={() => {
              setLogType("note");
              setLogOpen(true);
            }}
            onTask={() => setTaskOpen(true)}
            onStage={() => setStageSheetOpen(true)}
          />
        </div>

        <div className="mt-3">
          <FollowUpBar contactId={contact.id} nextFollowUpAt={contact.next_follow_up_at} />
        </div>
      </div>

      <div className="mt-4 flex border-b border-neutral-100 px-4">
        {(
          [
            ["overview", "Overview"],
            ["activity", `Activity ${activities.length}`],
            ["deals", `Deals ${deals.length}`],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "border-b-2 px-3 py-2.5 text-[15px] font-semibold",
              tab === value ? "border-brand-600 text-neutral-900" : "border-transparent text-neutral-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {tab === "overview" && (
          <OverviewTab
            contact={contact}
            tags={tags}
            stages={stages}
            mergeCandidates={mergeCandidates}
            textTemplates={textTemplates}
            insights={insights}
            ownerId={ownerId}
            openTasks={openTasks}
            lastExchange={lastExchange}
          />
        )}
        {tab === "activity" && <ActivityTab activities={activeActivities} contactId={contact.id} contactName={name} ownerId={ownerId} />}
        {tab === "deals" && (
          <DealsTab deals={deals} contactId={contact.id} ownerId={ownerId} contactName={name} contactCreatedAt={contact.created_at} representing={contact.representing} />
        )}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1 text-[14px] font-medium text-neutral-500"
        >
          More actions <ChevronDown size={16} className={cn("transition-transform", moreOpen && "rotate-180")} />
        </button>
        {moreOpen && (
          <div className="mt-2">
            <QuickActions contactId={contact.id} contactName={name} phone={contact.phone} email={contact.email} />
          </div>
        )}
      </div>

      <StageTagsSheet
        open={stageSheetOpen}
        onClose={() => setStageSheetOpen(false)}
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
      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        ownerId={ownerId}
        contactId={contact.id}
        contactName={name}
        initialType={logType}
      />
      {taskOpen && (
        <QuickAddMenu
          initialMode="task"
          initialContactId={contact.id}
          onClose={() => setTaskOpen(false)}
        />
      )}
    </div>
  );
}
