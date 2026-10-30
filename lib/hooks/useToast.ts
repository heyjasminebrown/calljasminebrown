"use client";

import { useCallback, useState } from "react";

export type ToastAction = { label: string; onClick: () => void };
export type ToastState = { id: number; message: string; tone: "default" | "error"; action?: ToastAction } | null;

// Minimal toast, added as optimistic UI's required companion - rollback
// needs some way to say "that didn't send" rather than silently reverting
// with no explanation. One toast at a time; a new one replaces whatever's
// showing. The optional action (e.g. "Undo") is a second, explicit tap -
// tapping the toast body itself just dismisses it, same as before.
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, tone: "default" | "error" = "default", action?: ToastAction) => {
    const id = Date.now();
    setToast({ id, message, tone, action });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 3200);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
