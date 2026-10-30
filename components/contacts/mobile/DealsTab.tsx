import { DealsList } from "@/components/contacts/DealsList";
import type { Deal, Representing } from "@/types/database";

export function DealsTab({
  deals,
  contactId,
  ownerId,
  contactName,
  contactCreatedAt,
  representing,
}: {
  deals: Deal[];
  contactId: string;
  ownerId: string;
  contactName: string;
  contactCreatedAt: string;
  representing: Representing | null;
}) {
  return (
    <div className="rounded-[16px] border border-[#ebe9e7] bg-white p-4">
      <DealsList deals={deals} contactId={contactId} ownerId={ownerId} contactName={contactName} contactCreatedAt={contactCreatedAt} representing={representing} />
    </div>
  );
}
