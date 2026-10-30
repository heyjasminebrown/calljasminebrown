"use client";

import { useEffect, useState } from "react";

// A `position: fixed` bottom sheet sized with 100vh/100dvh doesn't
// reliably shrink when the on-screen keyboard opens (especially running
// as an installed PWA, per the manifest in app/layout.tsx) - the layout
// viewport can stay full-height while the keyboard just covers the
// bottom of it, which pushes an items-end-aligned sheet's contents
// (title, search input, everything) up behind the keyboard instead of
// resizing to fit above it. window.visualViewport tracks the actually
// visible area in real time, keyboard included, everywhere it's
// supported (all current iOS/Android); falls back to a plain 100dvh box
// with no offset where it isn't.
export function useVisualViewportBox(): { height: string; top: number; keyboardInset: number } {
  const [box, setBox] = useState<{ height: string; top: number; keyboardInset: number }>({
    height: "100dvh",
    top: 0,
    keyboardInset: 0,
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setBox({ height: `${vv.height}px`, top: vv.offsetTop, keyboardInset });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}
