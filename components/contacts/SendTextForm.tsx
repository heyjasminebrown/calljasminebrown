"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { applyMergeFields } from "@/lib/crm/merge-fields";
import { Button, Textarea, Card } from "@/components/ui";
import { Send } from "lucide-react";

export function SendTextForm({
  contactId,
  phone,
  firstName,
  lastName,
}: {
  contactId: string;
  phone: string | null;
  firstName?: string;
  lastName?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!phone) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");

    const result = await sendTextToContact(
      contactId,
      phone as string,
      applyMergeFields(body, { first_name: firstName ?? "", last_name: lastName ?? "" }).trim(),
    );

    if (!result.ok) {
      setError(result.error);
      setSending(false);
      return;
    }

    setBody("");
    setSending(false);
    router.refresh();
  }

  return (
    <Card className="space-y-2">
      <form onSubmit={handleSend} className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Send a text via Quo…"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" size="md" disabled={sending || !body.trim()}>
          <Send size={16} />
        </Button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
  );
}
