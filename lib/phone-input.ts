import type { ClipboardEvent } from "react";
import { formatPhone } from "@/lib/utils";

// Phone fields show US numbers as (404) 789-5791: a pasted number is
// formatted immediately, a typed one when the field loses focus.
// Anything that isn't a 10-digit US number (or 1 + 10) is left as typed.
export function pastePhone(e: ClipboardEvent<HTMLInputElement>, apply: (formatted: string) => void) {
  const text = e.clipboardData.getData("text").trim();
  if (!text) return;
  e.preventDefault();
  apply(formatPhone(text));
}
