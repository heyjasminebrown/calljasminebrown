"use client";

import { useRef, useState } from "react";

export type SwipeRowAction = { icon: React.ComponentType<{ size?: number }>; label: string; bg: string; onClick: () => void };

// Hand-rolled swipe-to-reveal - no gesture library in this repo, none
// added for this. Pointer Events (not Touch Events) so the same code
// runs under mouse input too, not just touch.
//
// Axis lock, not preventDefault guessing: after an 8px dead zone, decide
// horizontal vs. vertical ONCE per gesture and never revisit it. Locking
// vertical means bailing out entirely and letting the row's native
// scroll take over - this is the actual mechanism behind "must not
// swallow vertical scroll."
//
// Do NOT setPointerCapture on pointerdown. Capturing immediately on an
// inner <a> swallows the subsequent click, so "open this contact" never
// fires. Capture only after the gesture is confirmed horizontal.
export function useSwipeRow({
  rowId,
  openRowId,
  onOpenChange,
  actions,
  reducedMotion,
}: {
  rowId: string;
  openRowId: string | null;
  onOpenChange: (rowId: string | null) => void;
  actions: SwipeRowAction[];
  reducedMotion: boolean;
}) {
  const actionWidth = 74;
  const maxReveal = actionWidth * actions.length;
  const commitThreshold = maxReveal * 0.4;
  const commitFirstAction = maxReveal * 0.7;

  const startX = useRef(0);
  const startY = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);
  const dragging = useRef(false);
  const didSwipe = useRef(false);
  const [liveTranslate, setLiveTranslate] = useState<number | null>(null);

  const isOpen = openRowId === rowId;
  const translateX = liveTranslate ?? (isOpen ? -maxReveal : 0);

  function reset() {
    dragging.current = false;
    axisLocked.current = null;
    setLiveTranslate(null);
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    axisLocked.current = null;
    dragging.current = true;
    didSwipe.current = false;
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisLocked.current === "y") {
        reset();
        return;
      }
      didSwipe.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    if (axisLocked.current !== "x") return;

    const base = isOpen ? -maxReveal : 0;
    const next = Math.min(0, Math.max(-maxReveal - 12, base + dx));
    setLiveTranslate(next);
  }

  function onPointerUp() {
    if (!dragging.current) {
      reset();
      return;
    }
    const current = liveTranslate ?? (isOpen ? -maxReveal : 0);
    const swiped = axisLocked.current === "x";
    dragging.current = false;
    axisLocked.current = null;

    if (swiped && Math.abs(current) >= commitFirstAction) {
      setLiveTranslate(null);
      onOpenChange(null);
      actions[0]?.onClick();
      return;
    }
    if (swiped && Math.abs(current) >= commitThreshold) {
      setLiveTranslate(null);
      onOpenChange(rowId);
      return;
    }
    setLiveTranslate(null);
    if (openRowId === rowId) onOpenChange(null);
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!didSwipe.current) return;
    didSwipe.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  return {
    isOpen,
    translateX,
    maxReveal,
    actionWidth,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture },
    transitionStyle: reducedMotion ? { transition: "none" } : { transition: liveTranslate === null ? "transform 180ms ease-out" : "none" },
  };
}
