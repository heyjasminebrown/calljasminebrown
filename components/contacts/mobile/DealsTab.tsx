import { DealsList } from "@/components/contacts/DealsList";
import type { Deal } from "@/types/database";

export function DealsTab({
  deals,
  contactId,
  ownerId,
  contactName,
  contactCreatedAt,
}: {
  deals: Deal[];
  contactId: string;
  ownerId: string;
  contactName: string;
  contactCreatedAt: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#ebe9e7] bg-white p-4">
      <DealsList deals={deals} contactId={contactId} ownerId={ownerId} contactName={contactName} contactCreatedAt={contactCreatedAt} />
    </div>
  );
}
