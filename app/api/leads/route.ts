import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { addTagByName } from "@/lib/crm/add-tag";
import { upsertActivity } from "@/lib/crm/activities";
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

// ILIKE pattern that matches only this exact text (case-insensitive).
function exactPattern(value: string) {
  return `"${value.replace(/[\\%_"]/g, (c) => `\\${c}`)}"`;
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
    const admin = createAdminClient();

    // Already in the CRM under this email (any contact, archived too)?
    const pattern = exactPattern(email);
    const { data: existing, error: lookupError } = await admin
      .from("contacts")
      .select("id, email, secondary_email")
      .eq("owner_id", ownerId)
      .or(`email.ilike.${pattern},secondary_email.ilike.${pattern}`)
      .limit(5);
    if (lookupError) throw new Error(`Couldn't check for an existing contact: ${lookupError.message}`);
    const match = (existing ?? []).find((c) => [c.email, c.secondary_email].some((e) => e && e.trim().toLowerCase() === email));
    if (match) return NextResponse.json({ ok: true, created: false, reason: "email already in CRM" });

    const { data: stages, error: stageError } = await admin.from("pipeline_stages").select("id, name").eq("owner_id", ownerId);
    if (stageError) throw new Error(`Couldn't load stages: ${stageError.message}`);
    const warm = stages?.find((s) => s.name.trim().toLowerCase() === "warm");
    if (!warm) throw new Error("There's no Warm stage");

    const contact = await findOrCreateContact(admin, ownerId, {
      email,
      phone,
      firstName,
      lastName: lastName || null,
      leadSource: source,
      relationshipType: "community",
      stageId: warm.id,
      // Email uniqueness was checked above; always create.
      candidates: [],
    });
    if (!contact) throw new Error("The contact couldn't be created");

    for (const tag of tags) await addTagByName(admin, ownerId, contact.id, tag);
    await upsertActivity(admin, ownerId, contact.id, "site_form", "site_form_signup", `${contact.id}:${form}`, {
      type: "note",
      direction: "none",
      occurred_at: new Date().toISOString(),
      body: `Signed up on ${form}`,
      metadata: { form, source },
    });

    return NextResponse.json({ ok: true, created: true, contactId: contact.id });
  } catch (err) {
    await reportFailure(`Website sign-up (${form}) couldn't be added to the CRM: ${email}`, err);
    return NextResponse.json({ ok: false, error: "Couldn't save the sign-up." }, { status: 500 });
  }
}
