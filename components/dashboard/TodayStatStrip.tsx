import Link from "next/link";

export function TodayStatStrip({
  totalActive,
  newLeadsWeek,
  hotCount,
  underContractCount,
  callsToday,
}: {
  totalActive: number;
  newLeadsWeek: number;
  hotCount: number;
  underContractCount: number;
  callsToday: number;
}) {
  const stats = [
    { label: "Calls today", value: callsToday },
    { label: "Active", value: totalActive },
    { label: "New this week", value: newLeadsWeek },
    { label: "Hot", value: hotCount },
    { label: "Under contract", value: underContractCount },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
      {stats.map((s) => (
        <span key={s.label} className="text-neutral-700">
          <span className="font-semibold text-neutral-900">{s.value}</span> {s.label}
        </span>
      ))}
      <Link href="/numbers" className="font-medium text-neutral-500">
        All numbers
      </Link>
    </div>
  );
}
