"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { syncContactToQuoAction } from "@/app/(app)/contacts/actions";
import { contactSchema, type ContactFormValues } from "@/lib/validation/contact";
import { CONTACT_TYPE_LABELS, TIMELINE_LABELS, REPRESENTING_LABELS, LEAD_SOURCES, cn } from "@/lib/utils";
import { dateInputToAppIso, isoToDateInput } from "@/lib/format-time";
import { useApplyStageChange } from "@/lib/hooks/useApplyStageChange";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import type { ContactWithRelations, DealSide, PipelineStage, Tag } from "@/types/database";
import type { MergeCandidate } from "@/lib/data/contacts";

const fieldClass = "mt-1.5 w-full rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-900";
const labelClass = "text-sm text-neutral-500";

// Replaces the standalone /contacts/[id]/edit page - same fields
// (contactSchema is shared with ContactForm, which still powers /contacts/new),
// just inline in one grid instead of six separate Cards across a whole page,
// with one Save for the lot rather than a form you navigate away from.
// Phone and email lead the grid since a missing number is the most common
// fix. Duplicate-detection (a create-time concern) is dropped here - the
// footer's "Merge duplicate" already covers an existing contact turning
// out to be the same person as another.
export function ContactDetailsCard({
  contact,
  tags,
  stages,
  contacts,
}: {
  contact: ContactWithRelations;
  tags: Tag[];
  stages: PipelineStage[];
  contacts: MergeCandidate[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(contact.contact_tags.filter((ct) => ct.tags).map((ct) => ct.tags!.id));
  const [addingTag, setAddingTag] = useState(false);
  const { move: applyMove, dealModal, pendingCleanup, clearDealModal, clearPendingCleanup } = useApplyStageChange(contact.owner_id);

  const {
    register,
    handleSubmit,
    watch,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact.first_name,
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      secondary_phone: contact.secondary_phone ?? "",
      contact_type: contact.contact_type,
      representing: contact.representing,
      listing_address: contact.listing_address ?? "",
      listing_timeline: contact.listing_timeline,
      stage_id: contact.stage_id,
      lead_source: contact.lead_source ?? "",
      lead_date: isoToDateInput(contact.lead_date),
      budget_min: contact.budget_min ?? undefined,
      budget_max: contact.budget_max ?? undefined,
      areas_of_interest: (contact.areas_of_interest ?? []).join(", "),
      timeline: contact.timeline,
      next_follow_up_at: isoToDateInput(contact.next_follow_up_at),
      birthday: contact.birthday ?? "",
      referred_by: contact.referred_by ?? "",
      lease_ends_at: isoToDateInput(contact.lease_ends_at),
      address_line1: contact.address_line1 ?? "",
      address_line2: contact.address_line2 ?? "",
      city: contact.city ?? "",
      state: contact.state ?? "",
      postal_code: contact.postal_code ?? "",
      notes: contact.notes ?? "",
    },
  });

  const representing = watch("representing");
  const showListingFields = representing === "seller" || representing === "both";

  async function onSubmit(values: ContactFormValues) {
    setSubmitting(true);
    setServerError("");
    setSaved(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("Your session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const oldStage = stages.find((s) => s.id === contact.stage_id);
    const newStage = stages.find((s) => s.id === (values.stage_id || null));
    const stageChanged = (oldStage?.id ?? null) !== (newStage?.id ?? null);

    const payload = {
      owner_id: user.id,
      first_name: values.first_name,
      last_name: values.last_name || "",
      email: values.email || null,
      phone: values.phone || null,
      secondary_phone: values.secondary_phone || null,
      contact_type: values.contact_type,
      representing: values.representing || null,
      listing_address: values.listing_address || null,
      listing_timeline: values.listing_timeline || null,
      lead_source: values.lead_source || null,
      ...(values.lead_date ? { lead_date: dateInputToAppIso(values.lead_date) } : {}),
      budget_min: values.budget_min && !Number.isNaN(values.budget_min) ? values.budget_min : null,
      budget_max: values.budget_max && !Number.isNaN(values.budget_max) ? values.budget_max : null,
      areas_of_interest: values.areas_of_interest ? values.areas_of_interest.split(",").map((s) => s.trim()).filter(Boolean) : [],
      timeline: values.timeline,
      next_follow_up_at: values.next_follow_up_at ? dateInputToAppIso(values.next_follow_up_at) : null,
      birthday: values.birthday || null,
      referred_by: values.referred_by || null,
      lease_ends_at: values.lease_ends_at || null,
      address_line1: values.address_line1 || null,
      address_line2: values.address_line2 || null,
      city: values.city || null,
      state: values.state || null,
      postal_code: values.postal_code || null,
      notes: values.notes || null,
      ...(!stageChanged ? { stage_id: values.stage_id || null } : {}),
    };

    const { error } = await supabase.from("contacts").update(payload).eq("id", contact.id);
    if (error) {
      setServerError(error.message);
      setSubmitting(false);
      return;
    }

    if (stageChanged) {
      const ok = await applyMove(contact.id, oldStage, newStage);
      if (!ok) {
        setServerError("Contact info saved, but the stage change didn't finish. Try Move to… on Pipeline or the Stage sheet.");
        setSubmitting(false);
        return;
      }
    }

    const { error: tagDeleteError } = await supabase.from("contact_tags").delete().eq("contact_id", contact.id);
    if (tagDeleteError) {
      setServerError(`Contact info saved, but tags couldn't update: ${tagDeleteError.message}`);
      setSubmitting(false);
      return;
    }
    if (selectedTagIds.length > 0) {
      const { error: tagInsertError } = await supabase.from("contact_tags").insert(selectedTagIds.map((tagId) => ({ contact_id: contact.id, tag_id: tagId })));
      if (tagInsertError) {
        setServerError(`Contact info saved, but tags couldn't update: ${tagInsertError.message}`);
        setSubmitting(false);
        return;
      }
    }
    if (payload.phone) void syncContactToQuoAction(contact.id);

    setSubmitting(false);
    setSaved(true);
    router.refresh();
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-[18px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input type="tel" {...register("phone")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" {...register("email")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>First name</label>
          <input {...register("first_name")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input {...register("last_name")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Secondary phone</label>
          <input type="tel" {...register("secondary_phone")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select {...register("contact_type")} className={fieldClass}>
            {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Stage</label>
          <select {...register("stage_id")} className={fieldClass}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Timeline</label>
          <select {...register("timeline")} className={fieldClass}>
            {Object.entries(TIMELINE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Representing</label>
          <select {...register("representing")} className={fieldClass}>
            <option value="">Not applicable</option>
            {Object.entries(REPRESENTING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Lead source</label>
          <input list="lead-sources" {...register("lead_source")} className={fieldClass} />
          <datalist id="lead-sources">
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelClass}>Lead date</label>
          <input type="date" {...register("lead_date")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Next follow-up</label>
          <input type="date" {...register("next_follow_up_at")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Budget min</label>
          <input type="number" step="1000" {...register("budget_min")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Budget max</label>
          <input type="number" step="1000" {...register("budget_max")} className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Areas of interest</label>
          <input {...register("areas_of_interest")} placeholder="Comma-separated, e.g. Downtown, Riverside" className={fieldClass} />
        </div>

        {showListingFields && (
          <>
            <div>
              <label className={labelClass}>Listing address</label>
              <input {...register("listing_address")} placeholder="What are they selling?" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Listing timeline</label>
              <select {...register("listing_timeline")} className={fieldClass}>
                <option value="">Unknown</option>
                {Object.entries(TIMELINE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input {...register("address_line1")} placeholder="Address line 1" className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <input {...register("address_line2")} placeholder="Address line 2" className={cn(fieldClass, "mt-2")} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
          <input {...register("city")} placeholder="City" className={fieldClass} />
          <input {...register("state")} placeholder="State" className={fieldClass} />
          <input {...register("postal_code")} placeholder="ZIP" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Birthday</label>
          <input type="date" {...register("birthday")} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Referred by</label>
          <select {...register("referred_by")} className={fieldClass}>
            <option value="">Nobody on file</option>
            {contacts
              .filter((c) => c.id !== contact.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                </option>
              ))}
          </select>
        </div>
        {contact.contact_type === "renter" && (
          <div>
            <label className={labelClass}>Lease ends</label>
            <input type="date" {...register("lease_ends_at")} className={fieldClass} />
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className={labelClass}>Tags</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {tags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            if (!active && !addingTag) return null;
            return (
              <button
                type="button"
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: active ? tag.color : "#a8a29e" }}
              >
                {tag.name}
                {active && <X size={13} />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setAddingTag((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-neutral-500"
          >
            <Plus size={13} /> {addingTag ? "Done" : "Add tag"}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <label className={labelClass}>Notes</label>
        <textarea rows={4} {...register("notes")} placeholder="Anything else worth remembering…" className={fieldClass} />
      </div>

      {serverError && <p className="mt-3 text-sm text-red-600">{serverError}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={submitting} className="rounded-[10px] bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <span className="text-sm text-neutral-400">{saved ? "Saved." : "Edits happen here - no separate edit page."}</span>
      </div>

      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={`${contact.first_name} ${contact.last_name}`.trim()}
          defaultLeadStartedAt={contact.created_at}
          defaultSide={(contact.representing === "buyer" || contact.representing === "seller" ? contact.representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={clearDealModal}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={clearPendingCleanup} />}
    </form>
  );
}
