import Link from "next/link";
import { getSphereData } from "@/lib/data/sphere";
import { formatCurrency } from "@/lib/utils";
import { Section } from "@/components/ui/Section";
import { WorklistGroup } from "@/components/dashboard/WorklistGroup";
import { DraftMessageRow } from "@/components/sphere/DraftMessageRow";
import { ReviewRequestExtras } from "@/components/sphere/ReviewRequestExtras";
import { sendSphereMessage, sendReviewRequest, snoozeReviewRequest, dismissReviewRequest } from "@/app/(app)/sphere/actions";

function monthDraft(name: string, kind: "anniversary" | "birthday", label: string) {
  const firstName = name.split(" ")[0];
  if (kind === "birthday") return `Happy birthday, ${firstName}! Hope it's a great one.`;
  return `Hey ${firstName} - ${label.toLowerCase()}! Hope you're loving it. Let me know if you ever need anything.`;
}

function reviewDraft(name: string) {
  const firstName = name.split(" ")[0];
  return `Hey ${firstName}, so glad everything came together on the house! If you have a couple minutes, a review would mean a lot to me and help other buyers find me. No worries at all if not - just wanted to ask.`;
}

export default async function SpherePage() {
  const { totalPastClients, totalReferrers, thisMonth, goingQuiet, referrers, reviewCandidates } = await getSphereData();
  const maxReferralValue = Math.max(1, ...referrers.map((r) => r.value));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-[28px]">Past clients</h1>
      <p className="mt-1 text-[15px] text-neutral-500">
        {totalPastClients} past clients and {totalReferrers} people who have sent you business. Daily calls and texts live on Today.
      </p>

      <div className="mt-5 space-y-3">
        {reviewCandidates.length > 0 && (
          <Section sectionKey="sphere:reviews" title="Review requests" meta={`${reviewCandidates.length} suggested`}>
            {reviewCandidates.map((c) => (
              <DraftMessageRow
                key={c.dealId}
                contactId={c.contactId}
                name={c.name}
                meta={`Closed ${c.daysAgo} day${c.daysAgo === 1 ? "" : "s"} ago`}
                phone={c.phone}
                email={c.email}
                defaultDraft={reviewDraft(c.name)}
                onSend={sendReviewRequest.bind(null, c.dealId, c.contactId)}
                extra={
                  <ReviewRequestExtras
                    onSnooze={snoozeReviewRequest.bind(null, c.dealId, c.contactId)}
                    onDismiss={dismissReviewRequest.bind(null, c.dealId, c.contactId)}
                  />
                }
              />
            ))}
            <p className="border-t border-neutral-100 px-4 py-2.5 text-sm text-neutral-400">
              Only ever suggestions - nobody is asked for a review unless you press send on that person.
            </p>
          </Section>
        )}

        {thisMonth.length > 0 && (
          <Section sectionKey="sphere:month" title="This month" meta={`${thisMonth.length}`}>
            {thisMonth.map((h) => (
              <DraftMessageRow
                key={`${h.kind}:${h.contactId}`}
                contactId={h.contactId}
                name={h.name}
                meta={[h.label, h.meta].filter(Boolean).join(" · ")}
                phone={null}
                email={null}
                defaultDraft={monthDraft(h.name, h.kind, h.label)}
                onSend={sendSphereMessage.bind(null, h.contactId)}
              />
            ))}
            <p className="border-t border-neutral-100 px-4 py-2.5 text-sm text-neutral-400">
              Drafts are written for you but never sent on their own - you read each one first.
            </p>
          </Section>
        )}

        <Section sectionKey="sphere:quiet" title="Past clients going quiet" meta={`${goingQuiet.length} of ${totalPastClients}`} defaultOpen={false}>
          <WorklistGroup
            people={goingQuiet.map((c) => ({
              id: c.contactId,
              name: c.name,
              phone: c.phone,
              meta: `${c.monthsQuiet} month${c.monthsQuiet === 1 ? "" : "s"} since you last spoke${c.referralsSent > 0 ? ` · sent ${c.referralsSent} referral${c.referralsSent === 1 ? "" : "s"}` : ""}`,
              late: false,
            }))}
          />
          {goingQuiet.length > 0 && (
            <p className="border-t border-neutral-100 px-4 py-2.5 text-sm text-neutral-400">
              Two calls a week clears this list in a month. Everyone here already bought a house from you.
            </p>
          )}
        </Section>

        <Section sectionKey="sphere:referrers" title="Who sends you business" meta="last two years" defaultOpen={false}>
          <div className="p-[18px]">
            {referrers.length === 0 ? (
              <p className="text-[15px] text-neutral-400">No referrals on file yet.</p>
            ) : (
              <div className="space-y-3.5">
                {referrers.map((r, i) => {
                  const pct = Math.max((r.value / maxReferralValue) * 100, r.value > 0 ? 4 : 0);
                  return (
                    <Link key={r.contactId} href={`/contacts/${r.contactId}`} className="block">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-neutral-900">{r.name}</p>
                          <p className="truncate text-[15px] text-neutral-600">
                            {r.referralCount} referral{r.referralCount === 1 ? "" : "s"} · {r.closedCount} closed
                            {r.pendingCount > 0 ? `, ${r.pendingCount} in progress` : ""} · {formatCurrency(r.value)} to you
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-[180px] overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full rounded-full ${i === 0 ? "bg-brand-600" : "bg-neutral-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <p className="mt-4 text-sm text-neutral-400">
              Every contact gets a referred by field, so lead source stops being just the word Referral and starts being a person you can thank.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
