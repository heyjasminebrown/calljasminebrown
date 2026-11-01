import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";
import { STEP_LABELS, TEXT_CAMPAIGNS } from "@/lib/crm/text-automation";

export type EnrollmentRow = {
  id: string;
  contact_id: string;
  status: "active" | "completed" | "stopped";
  stop_reason: string | null;
  next_step: keyof typeof STEP_LABELS | null;
  next_send_at: string | null;
  last_step: keyof typeof STEP_LABELS | null;
  last_error: string | null;
  contacts: { first_name: string; last_name: string } | null;
};

// Read-only view of the Conventus Text Campaign: on/off, the texts, and
// where each enrolled contact is.
export function TextAutomationStatus({ enabled, rows, error }: { enabled: boolean; rows: EnrollmentRow[]; error: string | null }) {
  const campaign = TEXT_CAMPAIGNS.conventus;
  const active = rows.filter((r) => r.status === "active");
  const done = rows.filter((r) => r.status !== "active").slice(0, 10);
  const name = (r: EnrollmentRow) => [r.contacts?.first_name, r.contacts?.last_name].filter(Boolean).join(" ") || "Contact";

  return (
    <div className="space-y-4 text-[14px]">
      <p className={enabled ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
        {enabled
          ? "On - sending to new Conventus contacts."
          : "Off - new Conventus contacts are queued but nothing sends until TEXT_AUTOMATION_ENABLED=true is set in Vercel (after A2P approval)."}
      </p>
      {error && <p className="text-red-600">Couldn&apos;t load the campaign: {error}</p>}

      <ol className="space-y-1.5 text-neutral-600">
        {(Object.keys(campaign.steps) as (keyof typeof campaign.steps)[]).map((step) => (
          <li key={step}>
            <span className="font-semibold text-neutral-800">{STEP_LABELS[step]}:</span> {campaign.steps[step].replace("{first_name}", "[First Name]")}
          </li>
        ))}
      </ol>

      <div>
        <p className="font-semibold text-neutral-800">In progress ({active.length})</p>
        {active.length === 0 ? (
          <p className="text-neutral-500">No one right now.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {active.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2">
                <Link href={`/contacts/${r.contact_id}`} className="font-medium text-brand-700 hover:underline">
                  {name(r)}
                </Link>
                <span className="text-neutral-500">
                  {r.next_step
                    ? `${STEP_LABELS[r.next_step]} ${r.next_send_at ? formatInTimeZone(r.next_send_at, APP_TIMEZONE, "EEE MMM d, h:mm a") : ""}`
                    : "waiting"}
                </span>
                {r.last_error && <span className="text-red-600">Last error: {r.last_error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <p className="font-semibold text-neutral-800">Recently finished or stopped</p>
          <ul className="mt-1 space-y-1">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2">
                <Link href={`/contacts/${r.contact_id}`} className="font-medium text-brand-700 hover:underline">
                  {name(r)}
                </Link>
                <span className="text-neutral-500">{r.stop_reason ?? r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
