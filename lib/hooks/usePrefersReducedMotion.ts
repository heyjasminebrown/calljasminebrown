"use client";

import { useEffect, useState } from "react";

// Swipe rows and sheets still work with reduced motion - only the
// snap/slide transition shortens to an instant change, per the redesign's
// cross-cutting interaction rules.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
