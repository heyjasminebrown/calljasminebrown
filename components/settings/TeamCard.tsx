"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { addTeamMember, removeTeamMember } from "@/app/(app)/settings/team-actions";

export type TeamMemberRow = { id: string; email: string; createdAt: string };

export function TeamCard({ members, loadError, loginUrl }: { members: TeamMemberRow[]; loadError: string | null; loginUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy("add");
    setError("");
    const result = await addTeamMember(email);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    setError("");
    const result = await removeTeamMember(id);
    setBusy(null);
    setConfirming(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <Card id="team">
      <div className="space-y-3">
        <div>
          <p className="text-[17px] font-semibold text-neutral-900">Team</p>
          <p className="mt-1 text-sm text-neutral-500">
            People helping you. They sign in at <span className="font-medium text-neutral-700">{loginUrl.replace(/^https?:\/\//, "")}</span> with
            their own email and work in your CRM: same contacts, messages, campaigns and calendars. Emails and texts they send go out from your
            Gmail and Quo number. Only you can add or remove people.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm font-medium text-red-600">Couldn&apos;t load your team: {loadError}</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-neutral-400">No one yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="text-sm font-medium text-neutral-800">{m.email}</span>
                {confirming === m.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-red-700">Remove their access?</span>
                    <button type="button" className="font-semibold text-red-700 underline" disabled={busy === m.id} onClick={() => remove(m.id)}>
                      {busy === m.id ? "Removing…" : "Remove"}
                    </button>
                    <button type="button" className="font-medium text-neutral-500" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(m.id)}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${m.email}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loadError && (
          <form onSubmit={add} className="flex gap-2">
            <Input type="email" placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Team member email" />
            <Button type="submit" disabled={busy === "add" || !email.trim()} className="shrink-0">
              <UserPlus size={15} /> {busy === "add" ? "Adding…" : "Add"}
            </Button>
          </form>
        )}
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Card>
  );
}
