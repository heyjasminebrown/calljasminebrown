import type { Likelihood } from "@/lib/crm/likelihood";

const CONFIG: Record<Likelihood, { label: string; color: string }> = {
  high: { label: "High", color: "#22c55e" },
  medium: { label: "Med", color: "#f59e0b" },
  low: { label: "Low", color: "#94a3b8" },
};

export function LikelihoodBadge({ likelihood }: { likelihood: Likelihood | null }) {
  if (!likelihood) return null;
  const { label, color } = CONFIG[likelihood];
  return (
    <span
      title="Likelihood to close, based on stage, timeline, and engagement"
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
