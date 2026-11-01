import { NextResponse, type NextRequest } from "next/server";
import { listContacts } from "@/lib/data/contacts";
import { parseContactFilterParams } from "@/lib/crm/contact-filter-params";
import { formatPhone, RELATIONSHIP_TYPE_LABELS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

// One field per column, in order - kept deliberately narrow to what an
// email/mailing tool (Eventbrite's own contact list import, Mailchimp,
// etc.) actually wants. Never includes unsubscribe_token or owner_id -
// those are internal, not something that belongs in a downloaded file.
const HEADERS = ["First Name", "Last Name", "Email", "Secondary Email", "Phone", "Tags", "Type", "Stage", "Lead Source", "Lead Date"];

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRow(values: string[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Same query params the Contacts page's filters/segments/working queues
  // already use (parsed by the one shared function both places call) -
  // exporting respects whatever's currently filtered/searched/grouped on
  // screen instead of always dumping the entire contact list.
  const contacts = await listContacts(parseContactFilterParams(request.nextUrl.searchParams));

  let csv = csvRow(HEADERS);
  for (const c of contacts) {
    csv += csvRow([
      c.first_name,
      c.last_name ?? "",
      c.email ?? "",
      c.secondary_email ?? "",
      formatPhone(c.phone),
      c.contact_tags.filter((ct) => ct.tags).map((ct) => ct.tags!.name).join("; "),
      RELATIONSHIP_TYPE_LABELS[c.relationship_type] ?? c.relationship_type,
      c.pipeline_stages?.name ?? "",
      c.lead_source ?? "",
      c.lead_date ? c.lead_date.slice(0, 10) : "",
    ]);
  }

  const filename = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
