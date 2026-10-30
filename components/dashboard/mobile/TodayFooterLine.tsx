export function TodayFooterLine({
  totalActive,
  hotCount,
  underContractCount,
  underContractNet,
  callsToday,
}: {
  totalActive: number;
  hotCount: number;
  underContractCount: number;
  underContractNet: number;
  callsToday: number;
}) {
  return (
    <p className="mt-5 pb-4 pr-[140px] text-[14px] text-neutral-400">
      {callsToday} call{callsToday === 1 ? "" : "s"} today · {totalActive} active · {hotCount} hot · {underContractCount} under contract · $
      {Math.round(underContractNet).toLocaleString()} projected
    </p>
  );
}
