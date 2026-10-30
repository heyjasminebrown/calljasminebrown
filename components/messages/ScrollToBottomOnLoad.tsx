"use client";

import { useEffect, useRef } from "react";

// Chat threads should open scrolled to the most recent message, not the
// oldest - re-run when `token` changes (new last message after send /
// router.refresh) so the newest bubble isn't left under the composer.
// Double rAF waits for layout; visualViewport resize covers the keyboard
// pushing the composer up after first paint.
export function ScrollToBottomOnLoad({ token }: { token?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = () => ref.current?.scrollIntoView({ block: "end" });
    scroll();
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(scroll);
    });
    const vv = window.visualViewport;
    vv?.addEventListener("resize", scroll);
    const timeout = window.setTimeout(scroll, 120);
    return () => {
      cancelAnimationFrame(raf1);
      vv?.removeEventListener("resize", scroll);
      window.clearTimeout(timeout);
    };
  }, [token]);

  return <div ref={ref} />;
}
