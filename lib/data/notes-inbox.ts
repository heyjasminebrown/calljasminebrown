import { createClient } from "@/lib/supabase/server";
import { extractStoredTranscriptText, extractStoredSummary } from "@/lib/granola/parse-event";
import { findNameCandidates, getGranolaMatchingRules } from "@/lib/crm/note-name-match";
import type { MeetingTranscript } from "@/types/database";

export type UnmatchedNote = {
  id: string;
  occurredAt: string;
  preview: string;
  participantNames: string[];
  candidates: { id: string; name: string }[];
};

export type MatchedNote = {
  transcriptId: string;
  contactId: string;
  contactName: string;
  occurredAt: string;
  pendingCount: number;
};

function preview(text: string, max = 160): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export async function getUnmatchedNotesCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("meeting_transcripts").select("id", { count: "exact", head: true }).is("contact_id", null);
  return count ?? 0;
}

export async function getNotesInboxData(): Promise<{ unmatched: UnmatchedNote[]; matched: MatchedNote[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { unmatched: [], matched: [] };

  const [{ data: unmatchedRows }, { data: readyRows }, rules, { data: contacts }] = await Promise.all([
    supabase.from("meeting_transcripts").select("*").is("contact_id", null).order("occurred_at", { ascending: false }).limit(50),
    supabase
      .from("meeting_transcripts")
      .select("id, contact_id, occurred_at, contacts(first_name, last_name)")
      .eq("status", "ready")
      .not("contact_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(50),
    getGranolaMatchingRules(supabase, user.id),
    supabase.from("contacts").select("id, first_name, last_name").eq("archived", false),
  ]);

  const unmatched: UnmatchedNote[] = ((unmatchedRows ?? []) as MeetingTranscript[]).map((t) => {
    const transcriptText = extractStoredTranscriptText(t.raw_payload);
    const summaryText = extractStoredSummary(t.raw_payload);
    // Name-candidate matching still scans the full transcript (a name
    // mentioned once mid-conversation might never make it into Granola's
    // own summary) - only the preview shown to her prefers the summary,
    // since it's the readable version of "what was this note about."
    const candidates = rules.ask_when_ambiguous ? findNameCandidates(contacts ?? [], transcriptText).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() })) : [];
    return {
      id: t.id,
      occurredAt: t.occurred_at,
      preview: preview(summaryText || transcriptText || t.summary_bullets.join(" ") || "No transcript text captured."),
      participantNames: t.participants.map((p) => p.name).filter((n): n is string => !!n),
      candidates,
    };
  });

  const transcriptIds = (readyRows ?? []).map((r) => r.id);
  const { data: pendingCounts } =
    transcriptIds.length > 0
      ? await supabase.from("proposed_changes").select("transcript_id").eq("status", "pending").in("transcript_id", transcriptIds)
      : { data: [] as { transcript_id: string }[] };
  const countByTranscript = new Map<string, number>();
  for (const row of pendingCounts ?? []) countByTranscript.set(row.transcript_id, (countByTranscript.get(row.transcript_id) ?? 0) + 1);

  const matched: MatchedNote[] = (readyRows ?? [])
    .map((row) => {
      const contact = row.contacts as unknown as { first_name: string; last_name: string } | null;
      const pendingCount = countByTranscript.get(row.id) ?? 0;
      if (!contact || !row.contact_id || pendingCount === 0) return null;
      return {
        transcriptId: row.id,
        contactId: row.contact_id as string,
        contactName: `${contact.first_name} ${contact.last_name}`.trim(),
        occurredAt: row.occurred_at as string,
        pendingCount,
      };
    })
    .filter((r): r is MatchedNote => !!r);

  return { unmatched, matched };
}
