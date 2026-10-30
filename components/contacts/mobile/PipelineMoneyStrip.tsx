import { formatCurrency } from "@/lib/utils";

export function PipelineMoneyStrip({
  underContractTotal,
  hotCount,
  goneQuietCount,
  noContactCount,
}: {
  underContractTotal: number;
  hotCount: number;
  goneQuietCount: number;
  noContactCount: number;
}) {
  return (
    <div className="mx-4 mb-3 rounded-[20px] bg-neutral-900 p-4 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-white/50">Under contract</p>
          <p className="mt-0.5 font-serif text-[22px] font-semibold text-white">{formatCurrency(underContractTotal)}</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-white/50">Hot/Ready</p>
          <p className="mt-0.5 text-[17px] font-semibold text-white">{hotCount} people</p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold uppercase tracking-[.05em] text-white/50">At risk</p>
          <p className="mt-0.5 text-[17px] font-semibold text-[#fbbf24]">{goneQuietCount}</p>
        </div>
      </div>
      {(goneQuietCount > 0 || noContactCount > 0) && (
        <p className="mt-2.5 text-[14px] text-white/70">
          {goneQuietCount > 0 && `${goneQuietCount} in Hot/Ready gone quiet 30+ days`}
          {goneQuietCount > 0 && noContactCount > 0 && " · "}
          {noContactCount > 0 && `${noContactCount} new leads never contacted`}
        </p>
      )}
    </div>
  );
}
