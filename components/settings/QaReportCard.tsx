import { Section } from "@/components/ui/Section";
import type { QaCheck, QaSection, QaStatus } from "@/lib/qa/checks";
import Link from "next/link";

const STATUS_STYLES: Record<QaStatus, string> = {
  ok: "bg-neutral-100 text-neutral-500",
  warn: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<QaStatus, string> = {
  ok: "OK",
  warn: "Check",
  error: "Broken",
};

function QaCheckRow({ check }: { check: QaCheck }) {
  return (
    <div className="flex items-start gap-3.5 border-b border-neutral-100 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium text-neutral-900">{check.label}</p>
        <p className="mt-0.5 text-[15px] leading-[22px] text-neutral-600">
          {check.detail}
          {check.link && (
            <>
              {" · "}
              <Link href={check.link} className="font-semibold text-brand-600">
                View
              </Link>
            </>
          )}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${STATUS_STYLES[check.status]}`}>{STATUS_LABELS[check.status]}</span>
    </div>
  );
}

export function QaReportCard({ sections }: { sections: QaSection[] }) {
  const totalWarnings = sections.flatMap((s) => s.checks).filter((c) => c.status !== "ok").length;

  return (
    <Section sectionKey="settings:qa" title="System health" meta={totalWarnings > 0 ? `${totalWarnings} to look at` : "All clear"} defaultOpen={totalWarnings > 0}>
      <div className="px-[18px] py-4">
        <p className="text-[15px] leading-[22px] text-neutral-600">
          Checks real data, not just whether an integration is configured - a Gmail token that stopped refreshing or a text blast
          stuck mid-send shows up here even though the Connections list above would still say &ldquo;Connected.&rdquo;
        </p>
      </div>
      {sections.map((section) => (
        <div key={section.key} className="border-t border-neutral-100 px-[18px] py-4">
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-neutral-400">{section.label}</p>
          {section.checks.map((check) => (
            <QaCheckRow key={check.id} check={check} />
          ))}
        </div>
      ))}
    </Section>
  );
}
