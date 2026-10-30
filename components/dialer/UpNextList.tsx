import { Avatar } from "@/components/ui";
import { fullName } from "@/lib/utils";
import type { DialerContact } from "@/lib/data/dialer";

// The rest of the queue, underneath the card - desktop gets a bordered
// box with a count in its header bar; mobile gets a plain label above the
// same row shape. Not capped: "Up next N" in the header should always
// match how many rows are actually listed below it.
export function UpNextList({ contacts, layout = "mobile" }: { contacts: DialerContact[]; layout?: "mobile" | "desktop" }) {
  if (contacts.length === 0) return null;

  if (layout === "desktop") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#ebe9e7] bg-neutral-100 px-3.5 py-[7px]">
          <span className="whitespace-nowrap text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-700">
            Up next <span className="font-normal normal-case tracking-normal text-neutral-400">{contacts.length}</span>
          </span>
        </div>
        <div className="divide-y divide-neutral-100">
          {contacts.map((c) => (
            <UpNextRow key={c.id} contact={c} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Up next</p>
      <div className="divide-y divide-neutral-100 rounded-[14px] border border-[#ebe9e7] bg-white">
        {contacts.map((c) => (
          <UpNextRow key={c.id} contact={c} />
        ))}
      </div>
    </div>
  );
}

function UpNextRow({ contact }: { contact: DialerContact }) {
  const meta = contact.dialer_snoozed_at ? "Tried already" : contact.lead_source;

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <Avatar firstName={contact.first_name} lastName={contact.last_name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-neutral-700">{fullName(contact)}</p>
        {meta && <p className="truncate text-[13px] text-neutral-400">{meta}</p>}
      </div>
    </div>
  );
}
