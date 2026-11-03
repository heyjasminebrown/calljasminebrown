import { NextResponse, type NextRequest } from "next/server";

// Who may call the booking API from a browser: her website (plus any
// extra origins in BOOKING_API_ALLOWED_ORIGINS, comma-separated, e.g.
// http://localhost:3000 while building the page).
const DEFAULT_ORIGINS = ["https://heyjasminebrown.com", "https://www.heyjasminebrown.com"];

function allowedOrigins(): string[] {
  const extra = (process.env.BOOKING_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

export function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && allowedOrigins().includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function json(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export function preflight(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export const CALENDAR_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
