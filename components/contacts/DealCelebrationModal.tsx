"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { PROPERTY_TYPE_LABELS } from "@/lib/utils";
import { dateInputToAppIso, isoToDateInput, todayLocalDateInput } from "@/lib/format-time";
import { X, PartyPopper, Handshake, Plus } from "lucide-react";
import type { Deal, DealSide, DealStatus, PropertyType } from "@/types/database";

function toDateInputValue(value: string | null | undefined) {
  return isoToDateInput(value);
}

// Handles both UPDATE (dealId provided - the under-contract capture, the
// closed-deal celebration, and later editing) and INSERT (dealId omitted -
// manually adding another deal for a contact who already has one, e.g. a
// Buy/Sell contact under contract on both sides at once).
export function DealCelebrationModal({
  dealId,
  contactId,
  ownerId,
  contactName,
  defaultLeadStartedAt,
  defaultSide,
  initial,
  mode,
  onClose,
}: {
  dealId?: string;
  contactId?: string;
  ownerId?: string;
  contactName: string;
  defaultLeadStartedAt: string | null;
  defaultSide: DealSide | null;
  initial?: Partial<Deal>;
  mode: "under_contract" | "celebrate" | "edit" | "create";
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isStandaloneEdit = mode === "edit" && !initial?.contact_id;
  const [clientName, setClientName] = useState(initial?.client_name ?? "");
  const [status, setStatus] = useState<DealStatus>(initial?.status ?? (mode === "under_contract" ? "pending" : "won"));
  // A pending deal's closed_at means "entered under contract at," not a
  // real close date - the closing-date field and commission fields only
  // make sense once the deal is actually (or about to be marked) won.
  const isPendingContext = mode === "under_contract" || ((mode === "create" || mode === "edit") && status === "pending");
  const [closedAt, setClosedAt] = useState(toDateInputValue(initial?.closed_at) || todayLocalDateInput());
  const [expectedClosingDate, setExpectedClosingDate] = useState(toDateInputValue(initial?.expected_closing_date));
  const [address, setAddress] = useState(initial?.address ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType | "">(initial?.property_type ?? "");
  const [side, setSide] = useState<DealSide | "">(initial?.side ?? defaultSide ?? "");
  const [salePrice, setSalePrice] = useState(initial?.sale_price?.toString() ?? "");
  const [grossCommission, setGrossCommission] = useState(initial?.gross_commission?.toString() ?? "");
  const [referralPct, setReferralPct] = useState(initial?.referral_pct?.toString() ?? "");
  const [miscFee, setMiscFee] = useState(initial?.misc_fee?.toString() ?? "");
  const [ozFee, setOzFee] = useState(initial?.oz_fee?.toString() ?? "");
  const [onFmls, setOnFmls] = useState(initial?.on_fmls ?? true);
  const [manualSplit, setManualSplit] = useState(initial?.manual_split ?? false);
  const [kwFee, setKwFee] = useState(initial?.kw_fee?.toString() ?? "");
  const [kwriFee, setKwriFee] = useState(initial?.kwri_fee?.toString() ?? "");
  const [manualFmlsFee, setManualFmlsFee] = useState(initial?.fmls_fee?.toString() ?? "");
  const [tcFee, setTcFee] = useState(initial?.tc_fee?.toString() ?? "");
  const [leadStartedAt, setLeadStartedAt] = useState(isoToDateInput(initial?.lead_started_at ?? defaultLeadStartedAt));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  async function handleSave() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const fields: Record<string, unknown> = {
      address: address || null,
      property_type: propertyType || null,
      side: side || null,
      sale_price: salePrice ? Number(salePrice) : null,
      gross_commission: grossCommission ? Number(grossCommission) : null,
      misc_fee: miscFee ? Number(miscFee) : 0,
      oz_fee: ozFee ? Number(ozFee) : 0,
      manual_split: manualSplit,
      // Referral is always a percentage of gross, independent of manual_split
      // (which only covers KW/KWRI/FMLS/TC).
      referral_pct: referralPct ? Number(referralPct) : null,
      lead_started_at: leadStartedAt ? dateInputToAppIso(leadStartedAt) : null,
      notes: notes || null,
    };
    if (manualSplit) {
      fields.kw_fee = kwFee ? Number(kwFee) : 0;
      fields.kwri_fee = kwriFee ? Number(kwriFee) : 0;
      fields.fmls_fee = manualFmlsFee ? Number(manualFmlsFee) : 0;
      fields.tc_fee = tcFee ? Number(tcFee) : 0;
    } else {
      fields.on_fmls = onFmls;
    }
    if (!isPendingContext) fields.closed_at = dateInputToAppIso(closedAt);
    fields.expected_closing_date = expectedClosingDate || null;
    if (isStandaloneEdit) fields.client_name = clientName || null;

    if (dealId) {
      if (mode === "edit") fields.status = status;
      // .select() forces Supabase to return the updated row(s) - with RLS,
      // an update that matches zero rows (wrong owner, stale id, etc.)
      // otherwise succeeds silently with an empty result instead of
      // erroring, which would hide a real failure from her entirely.
      const { data, error: saveError } = await supabase.from("deals").update(fields).eq("id", dealId).select("id");
      setSaving(false);
      if (saveError) {
        setError(saveError.message);
        return;
      }
      if (!data || data.length === 0) {
        setError("Nothing was saved - this deal couldn't be found or you may not have permission to edit it.");
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("deals").insert({ owner_id: ownerId, contact_id: contactId, status, ...fields });
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between">
          {mode === "celebrate" && (
            <div>
              <p className="flex items-center gap-1.5 font-serif text-xl font-semibold text-neutral-900">
                <PartyPopper size={20} className="text-brand-600" /> Nice work!
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {contactName} just closed. Add the deal details while it&apos;s fresh — or skip and fill it in later.
              </p>
            </div>
          )}
          {mode === "under_contract" && (
            <div>
              <p className="flex items-center gap-1.5 font-serif text-xl font-semibold text-neutral-900">
                <Handshake size={20} className="text-brand-600" /> Under contract!
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                Lock in what you know about {contactName}&apos;s deal now — you can update anything once it
                actually closes.
              </p>
            </div>
          )}
          {mode === "edit" && <p className="font-serif text-xl font-semibold text-neutral-900">Edit deal</p>}
          {mode === "create" && (
            <div>
              <p className="flex items-center gap-1.5 font-serif text-xl font-semibold text-neutral-900">
                <Plus size={20} className="text-brand-600" /> Add a deal
              </p>
              <p className="mt-0.5 text-sm text-neutral-500">
                For {contactName} — use this when they have more than one deal going at once (e.g. buying and
                selling at the same time).
              </p>
            </div>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {(mode === "create" || mode === "edit") && (
            <div>
              <Label htmlFor="deal-status">Status</Label>
              <Select id="deal-status" value={status} onChange={(e) => setStatus(e.target.value as DealStatus)}>
                <option value="pending">Under Contract</option>
                <option value="won">Closed</option>
              </Select>
            </div>
          )}
          {isStandaloneEdit && (
            <div>
              <Label htmlFor="deal-client-name">Client name</Label>
              <Input
                id="deal-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Not linked to a contact"
              />
            </div>
          )}
          <div>
            <Label htmlFor="deal-address">Property address</Label>
            <Input id="deal-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          {isPendingContext ? (
            <div>
              <Label htmlFor="deal-expected-closing">Expected closing date</Label>
              <Input
                id="deal-expected-closing"
                type="date"
                value={expectedClosingDate}
                onChange={(e) => setExpectedClosingDate(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="deal-closed-at">Closing date</Label>
              <Input id="deal-closed-at" type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="deal-property-type">Property type</Label>
              <Select
                id="deal-property-type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType | "")}
              >
                <option value="">Select…</option>
                {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="deal-side">Side</Label>
              <Select id="deal-side" value={side} onChange={(e) => setSide(e.target.value as DealSide | "")}>
                <option value="">Select…</option>
                <option value="buyer">Buyer side</option>
                <option value="seller">Seller side</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="deal-sale-price">Sale price</Label>
              <Input
                id="deal-sale-price"
                type="number"
                step="1000"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deal-gross-commission">Gross commission</Label>
              <Input
                id="deal-gross-commission"
                type="number"
                step="100"
                value={grossCommission}
                onChange={(e) => setGrossCommission(e.target.value)}
                placeholder="Your side, before splits"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="deal-referral-pct">Referral %</Label>
              <Input
                id="deal-referral-pct"
                type="number"
                step="0.5"
                value={referralPct}
                onChange={(e) => setReferralPct(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="deal-misc-fee">Misc fee</Label>
              <Input id="deal-misc-fee" type="number" step="10" value={miscFee} onChange={(e) => setMiscFee(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="deal-oz-fee">OZ fee</Label>
              <Input id="deal-oz-fee" type="number" step="10" value={ozFee} onChange={(e) => setOzFee(e.target.value)} placeholder="0" />
            </div>
          </div>
          <p className="text-xs text-neutral-400">Referral is always taken off gross as a percentage, whether or not the fees below are entered exactly.</p>
          {(mode === "edit" || mode === "create") && (
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={manualSplit}
                onChange={(e) => setManualSplit(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Use exact fee amounts instead of calculating them
            </label>
          )}
          {manualSplit ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="deal-kw-fee">KW</Label>
                <Input id="deal-kw-fee" type="number" step="10" value={kwFee} onChange={(e) => setKwFee(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="deal-kwri-fee">KWRI</Label>
                <Input id="deal-kwri-fee" type="number" step="10" value={kwriFee} onChange={(e) => setKwriFee(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="deal-fmls-fee">FMLS</Label>
                <Input id="deal-fmls-fee" type="number" step="10" value={manualFmlsFee} onChange={(e) => setManualFmlsFee(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label htmlFor="deal-tc-fee">TC</Label>
                <Input id="deal-tc-fee" type="number" step="10" value={tcFee} onChange={(e) => setTcFee(e.target.value)} placeholder="0" />
              </div>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={onFmls}
                  onChange={(e) => setOnFmls(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                On FMLS
              </label>
              <p className="text-xs text-neutral-400">
                KW (30% to $15k cap), KWRI (3% to $3k cap), and TC ($500) are calculated automatically on the
                Commissions page based on your sale price and gross commission. FMLS (0.12% of price) only applies
                if the box above is checked. Misc and OZ are the only other splits you enter directly.
              </p>
            </>
          )}
          <div>
            <Label htmlFor="deal-lead-started">Started working with them</Label>
            <Input
              id="deal-lead-started"
              type="date"
              value={leadStartedAt}
              onChange={(e) => setLeadStartedAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked, what almost fell through, anything useful for predicting the next one…"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving…" : mode === "create" ? "Add deal" : "Save deal"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {mode === "edit" || mode === "create" ? "Cancel" : "Skip for now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
