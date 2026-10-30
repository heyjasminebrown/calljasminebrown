import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand/identity";

export function BrandWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <p
      className={cn(
        "font-serif font-semibold tracking-[-0.02em] text-brand-700",
        size === "sm" && "text-[16px] leading-5",
        size === "md" && "text-[18px] leading-6",
        size === "lg" && "text-[28px] leading-8",
        className,
      )}
    >
      {APP_NAME}{" "}
      <span
        className={cn(
          "align-middle font-sans font-semibold uppercase tracking-[0.18em] text-brand-600/75",
          size === "lg" ? "text-[11px]" : size === "sm" ? "text-[9px]" : "text-[10px]",
        )}
      >
        CRM
      </span>
    </p>
  );
}
