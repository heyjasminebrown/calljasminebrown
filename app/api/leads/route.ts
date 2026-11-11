import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { addWebsiteLead } from "@/lib/crm/website-lead";
import { reportFailure } from "@/lib/errors/report-failure";

export const dynamic = "force-dynamic";

// POST /api/leads - a sign-up from heyjasminebrown.com (e.g. /conference).
// Server-to-server only: the website's server sends
//   Authorization: Bearer <LEADS_API_SECRET>
// (the same value saved in both Vercel projects).
//
// Adds a NEW contact only when the email isn't already anywhere in the CRM
// (primary or secondary email, archived contacts included). New contacts
// are Type Community, Stage Warm. Someone already in the CRM is left
// exactly as they are.
//
// Body: { firstName, lastName, email, phone?, source?, tags?: string[], form? }
// 200 { ok: true, created: true, contactId } | { ok: true, created: false, reason: "email already in CRM" }
// 400 bad input · 401 wrong/missing secret · 500/503 server problem

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authorized(request: NextRequest): boolean | "unconfigured" {
  const secret = process.env.LEADS_API_SECRET;
  if (!secret) return "unconfigured";
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const ownerId = process.env.CRM_OWNER_USER_ID;
  const auth = authorized(request);
  if (auth === "unconfigured") {
    await reportFailure("Website sign-ups can't reach the CRM: LEADS_API_SECRET isn't set in the CRM's Vercel project");
    return NextResponse.json({ ok: false, error: "Not set up yet." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  if (!ownerId) return NextResponse.json({ ok: false, error: "Not set up yet." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Send JSON." }, { status: 400 });
  }
  const str = (k: string, max = 200) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const firstName = str("firstName", 100);
  const lastName = str("lastName", 100);
  const email = str("email").toLowerCase();
  const phone = str("phone", 40) || null;
  const source = str("source", 60) || "Website";
  const form = str("form", 100) || "website form";
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string" && !!t.trim()).map((t) => t.trim().slice(0, 60)).slice(0, 10) : [];

  if (!firstName) return NextResponse.json({ ok: false, error: "First name is required." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });

  try {
    const result = await addWebsiteLead(createAdminClient(), ownerId, { firstName, lastName, email, phone, source, tags, form });
    return NextResponse.json(result.created ? { ok: true, created: true, contactId: result.contactId } : { ok: true, created: false, reason: result.reason });
  } catch (err) {
    await reportFailure(`Website sign-up (${form}) couldn't be added to the CRM: ${email}`, err);
    return NextResponse.json({ ok: false, error: "Couldn't save the sign-up." }, { status: 500 });
  }
}
