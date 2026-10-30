"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignsTextHref } from "@/lib/crm/campaigns-handoff";
import { hasUsablePhone } from "@/lib/crm/contact-filter-predicates";
import { BulkTagModal } from "@/components/contacts/BulkTagModal";
import { BulkStageModal } from "@/components/contacts/BulkStageModal";
import { BulkAddToListModal } from "@/components/contacts/BulkAddToListModal";
import { cn } from "@/lib/utils";
import type { ContactSegment, ContactWithRelations, PipelineStage, Tag } from "@/types/database";

type BulkModal = "add-tag" | "remove-tag" | "stage" | "list" | null;

function Pill({
  children,
  onClick,
  disabled,
  filled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50",
        filled ? "bg-[#c45c4a] text-white" : "border border-[#eadfd6] bg-white text-neutral-800",
      )}
    >
      {children}
    </button>
  );
}

export function ContactsBulkBar({
  selectedIds,
  selectedContacts,
  tags,
  stages,
  segments,
  ownerId,
  onClear,
  variant = "desktop",
}: {
  selectedIds: string[];
  selectedContacts: ContactWithRelations[];
  tags: Tag[];
  stages: PipelineStage[];
  segments: ContactSegment[];
  ownerId: string;
  onClear: () => void;
  variant?: "desktop" | "mobile";
}) {
  const router = useRouter();
  const [modal, setModal] = useState<BulkModal>(null);
  const selectedWithPhone = selectedContacts.filter((c) => hasUsablePhone(c.phone)).length;
  const mobile = variant === "mobile";

  function afterAction() {
    setModal(null);
    onClear();
    router.refresh();
  }

  function textSelected() {
    const ids = selectedContacts.filter((c) => hasUsablePhone(c.phone)).map((c) => c.id);
    if (ids.length === 0) return;
    router.push(campaignsTextHref(ids));
  }

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", !mobile && "mb-3")}>
        {!mobile && <span className="text-[14px] font-semibold text-neutral-800">{selectedIds.length} selected</span>}
        <Pill filled onClick={textSelected} disabled={selectedWithPhone === 0}>
          Text
        </Pill>
        <Pill onClick={() => setModal("stage")}>{mobile ? "Stage" : "Change stage"}</Pill>
        <Pill onClick={() => setModal("list")}>{mobile ? "List" : "Add to list"}</Pill>
        <Pill onClick={() => setModal("add-tag")}>{mobile ? "Tags" : "Add tags"}</Pill>
        {!mobile && <Pill onClick={() => setModal("remove-tag")}>Remove tags</Pill>}
        {!mobile && (
          <button type="button" onClick={onClear} className="text-[13px] font-medium text-neutral-500">
            Clear
          </button>
        )}
      </div>

      {modal === "add-tag" && (
        <BulkTagModal mode="add" tags={tags} contactIds={selectedIds} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal === "remove-tag" && (
        <BulkTagModal mode="remove" tags={tags} contactIds={selectedIds} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal === "stage" && (
        <BulkStageModal contacts={selectedContacts} stages={stages} ownerId={ownerId} onClose={() => setModal(null)} onDone={afterAction} />
      )}
      {modal === "list" && (
        <BulkAddToListModal
          contactIds={selectedIds}
          segments={segments}
          ownerId={ownerId}
          onClose={() => setModal(null)}
          onDone={afterAction}
        />
      )}
    </>
  );
}
