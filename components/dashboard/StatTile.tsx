import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  subValue,
  tone = "default",
  href,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  tone?: "default" | "warning" | "critical" | "good";
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-serif text-2xl font-semibold",
          tone === "default" && "text-neutral-900",
          tone === "warning" && "text-amber-600",
          tone === "critical" && "text-red-600",
          tone === "good" && "text-emerald-600",
        )}
      >
        {value}
      </p>
      {subValue && <p className="mt-0.5 text-xs font-medium text-neutral-400">{subValue}</p>}
    </>
  );

  const className = cn(
    "rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-card",
    href && "transition hover:border-brand-200 hover:shadow-md",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
