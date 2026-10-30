"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ListRowTrailingAction = {
  icon: React.ComponentType<{ size?: number }>;
  variant: "primary" | "secondary";
  onClick: (e: React.MouseEvent) => void;
  "aria-label": string;
};

// The single most repeated element in the mobile redesign - one avatar,
// one text column, exactly one 48px trailing action. Replaces the
// button-cluster rows (ContactRow, ConversationRow) on mobile. Dividers
// live on the parent's wrapper (divide-y), not the row itself, so
// SwipeActions can wrap each row without fighting the divider.
export function ListRow({
  href,
  onClick,
  avatar,
  name,
  secondaryText,
  secondaryTone = "default",
  trailingAction,
  className,
}: {
  href?: string;
  onClick?: () => void;
  avatar: { firstName: string; lastName?: string | null };
  name: React.ReactNode;
  secondaryText?: React.ReactNode;
  secondaryTone?: "default" | "danger";
  trailingAction?: ListRowTrailingAction;
  className?: string;
}) {
  const content = (
    <div className={cn("flex min-h-[64px] items-center gap-3 bg-white px-4 py-3.5", className)}>
      <Avatar firstName={avatar.firstName} lastName={avatar.lastName} size={46} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold leading-[22px] text-neutral-900">{name}</p>
        {secondaryText && (
          <p className={cn("mt-0.5 truncate text-[15px] leading-[20px]", secondaryTone === "danger" ? "font-medium text-[#b91c1c]" : "text-neutral-500")}>
            {secondaryText}
          </p>
        )}
      </div>
      {trailingAction && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            trailingAction.onClick(e);
          }}
          aria-label={trailingAction["aria-label"]}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            trailingAction.variant === "primary" ? "bg-brand-600 text-white" : "border border-neutral-200 bg-white text-neutral-600",
          )}
        >
          <trailingAction.icon size={20} />
        </button>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block active:bg-neutral-50" data-contact-open={href.startsWith("/contacts/") ? href.replace("/contacts/", "") : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left active:bg-neutral-50">
      {content}
    </button>
  );
}
