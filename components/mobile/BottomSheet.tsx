"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { useVisualViewportBox } from "@/lib/hooks/useVisualViewportBox";

// Extends the existing modal convention used across ~19 files
// (ScheduleMeetingModal, TextBlastModal, ContactFiltersSheet,
// QuickAddMenu) rather than inventing a new one: no portal,
// conditionally rendered in the tree, fixed inset-0 overlay around a
// panel, parent owns the open boolean. This adds the mobile-redesign
// specific chrome on top - grab handle, drag-to-dismiss, sticky footer.
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { height, top } = useVisualViewportBox();
  const startY = useRef(0);
  const dragY = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function onHandlePointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    dragY.current = 0;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (startY.current === 0 && dragY.current === 0) return;
    const dy = Math.max(0, e.clientY - startY.current);
    dragY.current = dy;
    if (panelRef.current) panelRef.current.style.transform = `translateY(${dy}px)`;
  }

  function onHandlePointerUp() {
    const dy = dragY.current;
    startY.current = 0;
    dragY.current = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = reducedMotion ? "none" : "transform 180ms ease-out";
      panelRef.current.style.transform = "";
    }
    if (dy > 90) onClose();
  }

  return (
    <div
      className="fixed inset-x-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      style={{ top, height }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-[26px] bg-white shadow-[0_-12px_34px_rgba(28,25,23,0.18)] sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-2 pt-2.5 active:cursor-grabbing sm:hidden"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="h-[5px] w-11 rounded-full bg-neutral-200" />
        </div>
        {title && (
          <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-1 sm:pt-4">
            <p className="font-serif text-[21px] font-semibold text-neutral-900 sm:text-[22px]">{title}</p>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-neutral-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
