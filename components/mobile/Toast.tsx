"use client";

import type { ToastState } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils";

// Companion to optimistic UI - shows when an optimistic action's real
// server round-trip failed, since router.refresh() alone would just
// silently restore the truth with no explanation.
export function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss?: () => void }) {
  if (!toast) return null;
  return (
    <div
      className="fixed inset-x-4 z-[60] flex justify-center md:hidden"
      style={{ bottom: "calc(var(--app-bottom-nav) + 12px)" }}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px] font-medium text-white shadow-lg",
          toast.tone === "error" ? "bg-[#b91c1c]" : "bg-neutral-900",
        )}
      >
        <span>{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => {
              toast.action?.onClick();
              onDismiss?.();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
