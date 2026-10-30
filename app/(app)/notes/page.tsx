import { getNotesInboxData } from "@/lib/data/notes-inbox";
import { listMergeCandidates } from "@/lib/data/contacts";
import { Section } from "@/components/ui/Section";
import { UnmatchedNoteCard } from "@/components/notes/UnmatchedNoteCard";
import { MatchedNoteRow } from "@/components/notes/MatchedNoteRow";

export default async function NotesPage() {
  const [{ unmatched, matched }, contacts] = await Promise.all([getNotesInboxData(), listMergeCandidates()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-[28px]">Meeting notes</h1>
      <p className="mt-1 text-[15px] text-neutral-500">
        Granola captures that still need a look. Notes you log yourself live on the contact record.
      </p>

      <div className="mt-5 space-y-3">
        <Section sectionKey="notes:unmatched" title="Who was this with?" meta={`${unmatched.length}`}>
          {unmatched.length === 0 ? (
            <p className="px-4 py-6 text-[15px] text-neutral-400">Nothing unmatched right now.</p>
          ) : (
            unmatched.map((note) => <UnmatchedNoteCard key={note.id} note={note} contacts={contacts} />)
          )}
        </Section>

        <Section sectionKey="notes:matched" title="Ready to review" meta={`${matched.length}`}>
          {matched.length === 0 ? (
            <p className="px-4 py-6 text-[15px] text-neutral-400">Nothing waiting on a review right now.</p>
          ) : (
            matched.map((note) => <MatchedNoteRow key={note.transcriptId} note={note} />)
          )}
        </Section>
      </div>
    </div>
  );
}
