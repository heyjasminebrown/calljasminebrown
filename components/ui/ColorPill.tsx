import { cn } from "@/lib/utils";

// A pill with a colored dot on a soft tint of the same color - used for
// Type and Stage everywhere so both read the same way.
export function ColorPill({
  color,
  tint,
  children,
  className,
}: {
  color: string;
  tint: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-0.5 text-[12px] font-medium text-[#34223a]",
        className,
      )}
      style={{ backgroundColor: tint }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />;
}
