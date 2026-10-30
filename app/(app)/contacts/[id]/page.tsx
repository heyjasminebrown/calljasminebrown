import { notFound } from "next/navigation";
import {
  getContact,
  getContactActivities,
  getContactTasks,
  getContactInsights,
  getContactDeals,
  listStages,
  listMergeCandidates,
  listTags,
} from "@/lib/data/contacts";
import { fullName, formatPhone, initials, CONTACT_TYPE_LABELS } from "@/lib/utils";
import { formatLocal, isFollowUpOverdue } from "@/lib/format-time";
import { Section } from "@/components/ui/Section";
import { QuickActions } from "@/components/contacts/QuickActions";
import { SendMessageCard } from "@/components/contacts/SendMessageCard";
import { SuggestedRow } from "@/components/contacts/SuggestedRow";
import { ContactDetailsCard } from "@/components/contacts/ContactDetailsCard";
import { ActivityTimeline } from "@/components/contacts/ActivityTimeline";
import { AddActivityForm } from "@/components/contacts/AddActivityForm";
import { TaskList } from "@/components/contacts/TaskList";
import { ArchiveButton } from "@/components/contacts/ArchiveButton";
import { MergeContactButton } from "@/components/contacts/MergeContactButton";
import { DealsList } from "@/components/contacts/DealsList";
import { computeLikelihood } from "@/lib/crm/likelihood";
import { getLatestReadyTranscriptForContact } from "@/lib/data/meeting-transcripts";
import { ApprovePanel } from "@/components/transcripts/ApprovePanel";
import { ConsentStatus } from "@/components/contacts/ConsentStatus";
import { getInstagramSenderId } from "@/lib/data/instagram";
import { listTextTemplates } from "@/lib/data/text-templates";
import { countRecentTexts } from "@/lib/crm/engagement";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { firstTouchTemplate, resolveFirstTouchSource, shouldPrefillFirstTouchSms, eventbriteAccountFromActivities } from "@/lib/crm/new-lead-text-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContactRecordMobile } from "@/components/contacts/mobile/ContactRecordMobile";
import { ContactEngageBlock } from "@/components/contacts/ContactEngageBlock";
import Link from "next/link";
import { CalendarDays, ChevronLeft, Leaf } from "lucide-react";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const [contact, activities, tasks, stages, insights, deals, mergeCandidates, tags, readyTranscript, instagramSenderId, textTemplates, textsThisWeek] =
    await Promise.all([
      getContact(id),
      getContactActivities(id),
      getContactTasks(id),
      listStages(),
      getContactInsights(id),
      getContactDeals(id),
      listMergeCandidates(),
      listTags(),
      getLatestReadyTranscriptForContact(id),
      getInstagramSenderId(id),
      listTextTemplates(),
      countRecentTexts(admin, id),
    ]);

  if (!contact) notFound();

  const openTasks = tasks.filter((t) => !t.completed_at);
  const doneTasks = tasks.filter((t) => t.completed_at);
  const likelihood = computeLikelihood(contact, stages);
  const tagNames = contact.contact_tags.map((ct) => ct.tags?.name).filter((name): name is string => !!name);
  const firstTouchSignals = {
    leadSource: contact.lead_source,
    lastEventName: contact.last_event_name,
    tagNames,
    eventbriteAccount: eventbriteAccountFromActivities(activities),
  };
  const source = resolveFirstTouchSource(firstTouchSignals);
  const hasOutboundText = activities.some((a) => a.type === "text" && a.direction === "outbound");
  const firstTouchBody = shouldPrefillFirstTouchSms({ hasOutboundText, source })
    ? applyMergeFields(firstTouchTemplate(firstTouchSignals), contact)
    : undefined;

  const isOverdue = isFollowUpOverdue(contact.next_follow_up_at);
  const daysLate = isOverdue
    ? Math.max(1, Math.floor((Date.now() - new Date(contact.next_follow_up_at!).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const stage = stages.find((s) => s.id === contact.stage_id);

  return (
    <>
      <ContactRecordMobile
        contact={contact}
        stages={stages}
        tags={tags}
        activities={activities}
        deals={deals}
        insights={insights}
        mergeCandidates={mergeCandidates}
        textTemplates={textTemplates}
        ownerId={contact.owner_id}
        textsThisWeek={textsThisWeek}
        openTasks={openTasks.map((t) => ({ id: t.id, title: t.title, due_at: t.due_at }))}
        smsDraft={firstTouchBody}
      />
      <div className="mx-auto hidden w-full max-w-[1400px] px-8 py-8 lg:block">
      <Link href="/contacts" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-neutral-500 hover:text-neutral-800">
        <ChevronLeft size={18} /> Contacts
      </Link>
      <div className="flex flex-wrap items-start gap-[18px]">
        <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#f3e4dc] text-xl font-semibold text-brand-700">
          {initials(contact.first_name, contact.last_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[36px] font-semibold leading-9 tracking-[-0.03em] text-neutral-900">{fullName(contact)}</h1>
          <p className="mt-1.5 text-base leading-6 text-neutral-600">
            {[formatPhone(contact.phone), contact.email].filter(Boolean).join(" · ") || "No contact info on file"}
          </p>
          <p className="mt-1 text-base leading-6 text-neutral-600">
            {[CONTACT_TYPE_LABELS[contact.contact_type], contact.representing ? `${contact.representing} side` : null, likelihood ? `likelihood ${likelihood}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {contact.last_event_name && (
            <p className="mt-1 text-base leading-6 text-neutral-500">
              Last event: {contact.last_event_name}
              {contact.last_event_at && ` (${formatLocal(contact.last_event_at, "MMM d, yyyy")})`}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="flex h-[36px] items-center gap-1.5 rounded-full bg-[#f3e4dc] px-3 text-[14px] font-medium text-brand-700">
              <Leaf size={14} strokeWidth={2} />
              {stage?.name ?? "No stage"}
            </span>
            {contact.lead_source && (
              <span className="flex h-[36px] items-center gap-1.5 rounded-full border border-[#eadfd6] bg-[#fffbf8] px-3 text-[14px] font-medium text-neutral-600">
                <CalendarDays size={14} strokeWidth={1.8} className="text-brand-700" />
                Source: {contact.lead_source}
              </span>
            )}
            {contact.contact_tags
              .filter((ct) => ct.tags)
              .map((ct) => (
                <span
                  key={ct.tags!.id}
                  className="flex h-[36px] items-center rounded-full border border-[#eadfd6] bg-[#fffbf8] px-3 text-[14px] font-medium text-brand-700"
                >
                  {ct.tags!.name}
                </span>
              ))}
          </div>
          <ConsentStatus contactId={contact.id} optedOutAt={contact.opted_out_at} />
          {isOverdue && (
            <p className="mt-3 flex flex-wrap items-center gap-2.5 text-[15px] font-semibold text-red-700">
              Follow-up was due {formatLocal(contact.next_follow_up_at!, "MMM d")} — {daysLate} day{daysLate === 1 ? "" : "s"} late
              <a href="#details" className="rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800">
                Reschedule
              </a>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <ContactEngageBlock contact={contact} stages={stages} tags={tags} ownerId={contact.owner_id} smsDraft={firstTouchBody} />
      </div>

      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-7 space-y-3">
          {readyTranscript && (
            <ApprovePanel
              transcript={readyTranscript.transcript}
              proposals={readyTranscript.proposals}
              contactId={contact.id}
              contactName={fullName(contact)}
              ownerId={contact.owner_id}
              contactStageId={contact.stage_id}
              contactCreatedAt={contact.created_at}
              representing={contact.representing}
              stages={stages}
            />
          )}

          {insights.length > 0 && (
            <Section sectionKey="contact-detail:suggested" title="Suggested" meta={`${insights.length}`}>
              {insights.map((insight) => (
                <SuggestedRow
                  key={insight.id}
                  insight={insight}
                  contactId={contact.id}
                  ownerId={contact.owner_id}
                  contactStageId={contact.stage_id}
                  contactName={fullName(contact)}
                  contactCreatedAt={contact.created_at}
                  representing={contact.representing}
                  stages={stages}
                  tags={tags}
                />
              ))}
            </Section>
          )}

          <Section sectionKey="contact-detail:activity" title="Activity" meta={`${activities.length} entries`}>
            <div className="border-b border-neutral-100 p-[18px] pb-0">
              <AddActivityForm contactId={contact.id} ownerId={contact.owner_id} />
            </div>
            <ActivityTimeline activities={activities} />
          </Section>
        </div>

        <div className="col-span-5 space-y-3">
          <Section sectionKey="contact-detail:message" title="Send a message" meta="text or email" defaultOpen={false}>
            <SendMessageCard
              contactId={contact.id}
              phone={contact.phone}
              email={contact.email}
              firstName={contact.first_name}
              lastName={contact.last_name}
              initialBody={firstTouchBody}
            />
          </Section>

          <div id="details">
            <Section sectionKey="contact-detail:details" title="Details">
              <ContactDetailsCard contact={contact} tags={tags} stages={stages} contacts={mergeCandidates} />
            </Section>
          </div>

          <Section sectionKey="contact-detail:deals" title="Deals" meta={`${deals.length}`} defaultOpen={false}>
            <div className="p-[18px]">
              <DealsList
                deals={deals}
                contactId={contact.id}
                ownerId={contact.owner_id}
                contactName={fullName(contact)}
                contactCreatedAt={contact.created_at}
                representing={contact.representing}
              />
            </div>
          </Section>

          <Section sectionKey="contact-detail:tasks" title="Tasks" meta={`${openTasks.length} open`}>
            <TaskList contactId={contact.id} ownerId={contact.owner_id} tasks={[...openTasks, ...doneTasks]} />
          </Section>

          <Section sectionKey="contact-detail:more" title="More actions" defaultOpen={false}>
            <div className="p-[18px]">
              <QuickActions contactId={contact.id} contactName={fullName(contact)} phone={contact.phone} email={contact.email} instagramSenderId={instagramSenderId} />
            </div>
          </Section>

          <div className="flex items-center gap-2 border-t border-[#eadfd6] pt-5">
            <MergeContactButton contactId={contact.id} contactName={fullName(contact)} candidates={mergeCandidates} />
            <ArchiveButton contactId={contact.id} archived={contact.archived} />
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
