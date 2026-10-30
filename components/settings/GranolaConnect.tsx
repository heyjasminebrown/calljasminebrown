"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Copy, Check, Radio } from "lucide-react";

// No Zapier/Make relay here - Granola's own settings let her paste a
// webhook URL directly, so "connected" just means GRANOLA_WEBHOOK_SECRET
// is set (built server-side into this URL by the Settings page).
export function GranolaConnect({ webhookUrl }: { webhookUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "error" | null>(null);

  async function copyUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Sends a note id with no transcript - the route's own early-return for
  // a transcript-less event means this round-trips the secret check
  // without ever creating a meeting_transcripts row.
  async function testIt() {
    if (!webhookUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: `settings-test-${Date.now()}` }),
      });
      setTestResult(res.ok ? "ok" : "error");
    } catch {
      setTestResult("error");
    }
    setTesting(false);
  }

  if (!webhookUrl) {
    return <p className="text-sm text-amber-700">Add GRANOLA_WEBHOOK_SECRET to Vercel and redeploy to turn this on.</p>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">{webhookUrl}</span>
        <Button variant="secondary" size="sm" onClick={copyUrl} className="shrink-0">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-neutral-500">
        Paste this into Granola&apos;s own webhook settings — wherever it lets you add a custom webhook URL. No Zapier
        or Make needed; Granola sends straight here.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={testIt} disabled={testing}>
          <Radio size={14} /> {testing ? "Testing…" : "Test it"}
        </Button>
        {testResult === "ok" && <span className="text-sm font-medium text-emerald-700">Reachable — the secret checks out.</span>}
        {testResult === "error" && <span className="text-sm font-medium text-red-600">Couldn&apos;t reach it — double check the URL.</span>}
      </div>
      <p className="text-xs text-neutral-500">
        Covers video meetings (Zoom/Meet/Teams), in-person notes, and phone calls — however you captured it in
        Granola, it shows up the same way here. A note with no calendar invite and no attendee email (an in-person
        coffee, most phone calls) lands in the Notes inbox instead of a contact&apos;s page until you say who it was with.
      </p>
    </div>
  );
}
