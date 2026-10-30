import { listStages, listTags, listMergeCandidates } from "@/lib/data/contacts";
import { ContactForm } from "@/components/contacts/ContactForm";
import type { ContactType } from "@/types/database";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tag?: string }>;
}) {
  const [{ type, tag }, stages, tags, existingContacts] = await Promise.all([
    searchParams,
    listStages(),
    listTags(),
    listMergeCandidates(),
  ]);
  const defaultTagIds = tag ? tags.filter((t) => t.name === tag).map((t) => t.id) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Add contact</h1>
      <ContactForm
        stages={stages}
        tags={tags}
        existingContacts={existingContacts}
        defaultContactType={type as ContactType | undefined}
        defaultTagIds={defaultTagIds}
      />
    </div>
  );
}
