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
      {APP_NAME}
    </p>
  );
}
