// Magic-link `next` and login deep-link cookies must stay on this origin.
// A crafted `next=https://evil.example` (or `//evil.example`) would otherwise
// send a just-authenticated browser off-site after verifyOtp succeeds.
export function safeInternalPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  return trimmed;
}

export const AUTH_NEXT_COOKIE = "auth_next";
