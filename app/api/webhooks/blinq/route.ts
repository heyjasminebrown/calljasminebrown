import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordBlinqContact } from "@/lib/crm/blinq-contact";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Blinq Business only (Zapier's "Webhooks by Zapier" action on Blinq's
// "Contact Created" trigger - see README's Blinq section for the exact
// field names to map). Most people won't need this: lib/google/parse-
// blinq-email.ts catches the same shares for free by reading Blinq's own
// "X has sent you their details" notification email straight out of the
// Gmail sync, no Zapier or Business tier required. This route stays for
// whoever does have Business, going through the same recordBlinqContact
// helper either way. Same secret-in-URL auth as Eventbrite/Jotform/
// Granola, since neither Blinq nor Zapier's generic webhook action
// offers request signing.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.BLINQ_WEBHOOK_SECRET || secret !== process.env.BLINQ_WEBHOOK_SECRET) {
    console.error("Blinq webhook rejected: missing/incorrect secret");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!OWNER_ID) {
    console.error("Blinq webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = str(body.email);
  const phone = str(body.phone);
  const name = str(body.name);
  const firstName = str(body.first_name) ?? (name ? name.split(" ")[0] : null);
  const lastName = str(body.last_name) ?? (name ? name.split(" ").slice(1).join(" ") || null : null);
  const company = str(body.company);
  const jobTitle = str(body.job_title);
  const blinqContactId = str(body.blinq_contact_id) ?? str(body.id);

  if (!email && !phone) {
    console.log("Blinq webhook missing both email and phone, skipping", body);
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  try {
    await recordBlinqContact(admin, OWNER_ID, { firstName, lastName, email, phone, company, jobTitle, dedupeId: blinqContactId });
  } catch (err) {
    console.error("Error processing Blinq webhook", err);
  }

  return NextResponse.json({ received: true });
}
