import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function page(message: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#faf9f7;color:#292524;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;}
.card{max-width:400px;text-align:center;background:#fff;border-radius:16px;padding:32px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
h1{font-size:1.25rem;margin:0 0 8px;}p{color:#78716c;font-size:0.9rem;margin:0;}</style></head>
<body><div class="card"><h1>You're unsubscribed</h1><p>${message}</p></div></body></html>`;
}

async function unsubscribe(token: string, sendId: string | null) {
  const admin = createAdminClient();

  const { data: contact } = await admin.from("contacts").select("id").eq("unsubscribe_token", token).maybeSingle();
  if (!contact) return { ok: false as const };

  let sequenceId: string | null = null;
  if (sendId) {
    const { data: send } = await admin.from("email_sequence_sends").select("sequence_id, contact_id").eq("id", sendId).maybeSingle();
    if (send && send.contact_id === contact.id) {
      sequenceId = send.sequence_id;
      await admin.from("email_sequence_sends").update({ unsubscribed_at: new Date().toISOString() }).eq("id", sendId);
    }
  }

  if (sequenceId) {
    await admin
      .from("email_sequence_exclusions")
      .upsert({ sequence_id: sequenceId, contact_id: contact.id }, { onConflict: "sequence_id,contact_id" });
    await admin.from("email_sequence_enrollments").update({ status: "completed" }).eq("sequence_id", sequenceId).eq("contact_id", contact.id);
  }

  return { ok: true as const, sequenceId };
}

// Public, unauthenticated - reached from a link in an email, clicked by a
// contact, not the logged-in agent. Only ever removes them from the one
// sequence the link belongs to (see lib/crm/sequences.ts), not everything.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sendId = request.nextUrl.searchParams.get("send");
  const result = await unsubscribe(token, sendId);

  if (!result.ok) {
    return new NextResponse(page("This unsubscribe link is no longer valid."), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  const message = result.sequenceId
    ? "You won't receive any more emails from this list."
    : "We couldn't tell which list this was for, so please reply to any email if you're still receiving ones you don't want.";
  return new NextResponse(page(message), { headers: { "Content-Type": "text/html" } });
}

// RFC 8058 one-click unsubscribe - mail clients (Gmail, Outlook, etc.) that
// show an "Unsubscribe" button next to the sender POST here directly with
// List-Unsubscribe=One-Click, instead of opening the GET link in a browser.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sendId = request.nextUrl.searchParams.get("send");
  const result = await unsubscribe(token, sendId);
  return new NextResponse(null, { status: result.ok ? 200 : 404 });
}
