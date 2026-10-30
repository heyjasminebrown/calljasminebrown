"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendEmailToContact } from "@/app/(app)/contacts/actions";
import { Button, Input, Textarea, Card } from "@/components/ui";
import { Send } from "lucide-react";

export function SendEmailForm({ contactId, email }: { contactId: string; email: string | null }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!email) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError("");

    const result = await sendEmailToContact(contactId, email as string, subject.trim(), body.trim());

    if (!result.ok) {
      setError(result.error);
      setSending(false);
      return;
    }

    setSubject("");
    setBody("");
    setSending(false);
    router.refresh();
  }

  return (
    <Card className="space-y-2">
      <form onSubmit={handleSend} className="space-y-2">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Send an email via Gmail…"
            rows={3}
            className="flex-1"
          />
          <Button type="submit" size="md" disabled={sending || !subject.trim() || !body.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
  );
}
