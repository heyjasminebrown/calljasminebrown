import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand/identity";

export function BrandWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  return (
    <p
      className={cn(
        "font-serif font-semibold tracking-[-0.02em] text-brand-700",
        // xs fits "CallJasmineBrown" in the 220px desktop sidebar beside the headshot.
        size === "xs" && "whitespace-nowrap text-[14px] leading-5",
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
