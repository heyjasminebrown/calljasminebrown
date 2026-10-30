import { REPRESENTING_LABELS, REPRESENTING_COLORS } from "@/lib/utils";
import type { Representing } from "@/types/database";

export function RepresentingBadge({ representing }: { representing: Representing | null }) {
  if (!representing) return null;
  const color = REPRESENTING_COLORS[representing];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {REPRESENTING_LABELS[representing]}
    </span>
  );
}
