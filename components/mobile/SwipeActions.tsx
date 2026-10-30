"use client";

import { useSwipeRow, type SwipeRowAction } from "@/lib/hooks/useSwipeRow";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

// Reveals up to 3 actions behind a row on swipe-left. Single-open-row
// state (openRowId/onOpenChange) is owned by the screen's list wrapper,
// not this component, so opening one row closes another.
export function SwipeActions({
  rowId,
  openRowId,
  onOpenChange,
  actions,
  children,
}: {
  rowId: string;
  openRowId: string | null;
  onOpenChange: (rowId: string | null) => void;
  actions: SwipeRowAction[];
  children: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { translateX, actionWidth, handlers, transitionStyle } = useSwipeRow({
    rowId,
    openRowId,
    onOpenChange,
    actions,
    reducedMotion,
  });

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }} onClickCapture={handlers.onClickCapture}>
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              onOpenChange(null);
              action.onClick();
            }}
            className="flex h-full flex-col items-center justify-center gap-1 text-white"
            style={{ width: actionWidth, backgroundColor: action.bg }}
          >
            <action.icon size={20} />
            <span className="text-[12px] font-semibold">{action.label}</span>
          </button>
        ))}
      </div>
      <div
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
        style={{ transform: `translateX(${translateX}px)`, ...transitionStyle }}
      >
        {children}
      </div>
    </div>
  );
}
