"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bulkImportContacts } from "@/app/(app)/contacts/actions";
import { Button, Textarea, Select, Input, Label } from "@/components/ui";
import { fullName } from "@/lib/utils";
import { X, AlertTriangle, Upload } from "lucide-react";
import { parseBulkContacts, type ParsedContactRow } from "@/lib/crm/bulk-import-contacts";
import type { Tag } from "@/types/database";

const TEMPLATE = "First Name\tLast Name\tEmail\tPhone\tDate";

export function BulkImportContactsModal({
  tags,
  ownerId,
  onClose,
}: {
  tags: Tag[];
  ownerId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{ rows: ParsedContactRow[]; unmatchedHeaders: string[] } | null>(null);
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; matched: number; failed: number } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
  }

  function handleParse() {
    setError("");
    setParsed(parseBulkContacts(text));
  }

  const validRows = parsed?.rows.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsed?.rows.filter((r) => r.errors.length > 0) ?? [];

  async function createTag() {
    if (!newTagName.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("tags")
      .insert({ owner_id: ownerId, name: newTagName.trim(), color: "#94a3b8" })
      .select("id, name")
      .single();
    if (data) {
      tags.push(data as Tag);
      setTagId(data.id);
    }
    setNewTagName("");
    setCreatingTag(false);
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setSaving(true);
    setError("");
    const tagName = tags.find((t) => t.id === tagId)?.name ?? null;
    const outcome = await bulkImportContacts(validRows, tagName, leadSource.trim() || "CSV import");
    setSaving(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setResult({ created: outcome.created, matched: outcome.matched, failed: outcome.failed });
    router.refresh();
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
        <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
          <p className="font-serif text-xl font-semibold text-neutral-900">Import complete</p>
          <div className="mt-3 space-y-1 text-sm text-neutral-600">
            <p>{result.created} new contact{result.created === 1 ? "" : "s"} added</p>
            <p>{result.matched} already existed — matched by email/phone and updated</p>
            {result.failed > 0 && <p className="text-amber-600">{result.failed} couldn&apos;t be matched or created</p>}
          </div>
          <Button onClick={onClose} className="mt-5 w-full">
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <p className="font-serif text-xl font-semibold text-neutral-900">Bulk import contacts</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          Upload a CSV, or paste rows straight from a spreadsheet. Anyone who already exists (matched by email or
          phone) gets updated instead of duplicated.
        </p>

        {!parsed && (
          <div className="mt-4 space-y-3">
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleFile} className="hidden" />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> {fileName || "Choose a CSV file…"}
            </Button>
            <Textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={TEMPLATE}
              className="font-mono text-xs"
            />
            <p className="text-xs text-neutral-400">
              Recognized headers: First Name, Last Name (or a single Name/Full Name column), Email, Phone, and an
              optional Date column (booking/signup/registration date &mdash; any of &ldquo;Date&rdquo;, &ldquo;Booking
              Date&rdquo;, &ldquo;Registration Date&rdquo;, &ldquo;Signup Date&rdquo;, &ldquo;Date Added&rdquo; work).
              Extra columns are ignored. Each row needs a name and at least an email or phone. Without a Date
              column, imported contacts are dated today &mdash; if that&apos;s wrong, re-import the same file later
              with a Date column added and existing contacts get corrected instead of duplicated.
            </p>
            <Button onClick={handleParse} disabled={!text.trim()}>
              Preview
            </Button>
          </div>
        )}

        {parsed && (
          <div className="mt-4 space-y-3">
            {parsed.unmatchedHeaders.length > 0 && (
              <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-700">
                Ignored columns (not recognized): {parsed.unmatchedHeaders.join(", ")}
              </p>
            )}

            {invalidRows.length > 0 && (
              <div className="space-y-1 rounded-xl bg-red-50 p-2.5 text-xs text-red-700">
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={13} /> {invalidRows.length} row(s) will be skipped
                </p>
                {invalidRows.map((r) => (
                  <p key={r.line}>
                    Row {r.line} ({fullName({ first_name: r.firstName ?? "", last_name: r.lastName }) || r.email || r.phone || "unlabeled"}):{" "}
                    {r.errors.join("; ")}
                  </p>
                ))}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-neutral-100 text-neutral-400">
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Email</th>
                    <th className="px-2 py-1.5 font-medium">Phone</th>
                    <th className="px-2 py-1.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((r) => (
                    <tr key={r.line} className="border-b border-neutral-50 last:border-0">
                      <td className="px-2 py-1.5">{fullName({ first_name: r.firstName ?? "", last_name: r.lastName }) || "—"}</td>
                      <td className="px-2 py-1.5">{r.email ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.phone ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {r.leadDate ? new Date(r.leadDate).toLocaleDateString() : <span className="text-neutral-300">Today</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Label htmlFor="import-lead-source">Lead source (how did they come in?)</Label>
              <Input
                id="import-lead-source"
                placeholder="e.g. Eventbrite - House Hacking Meetup"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Only applied to brand-new contacts — anyone already on file keeps their original lead source. Anyone
                imported with a phone number shows up in Event calls automatically.
              </p>
            </div>

            <div>
              <Label htmlFor="import-tag">Tag everyone imported with</Label>
              {creatingTag ? (
                <div className="flex gap-2">
                  <Input autoFocus placeholder="New tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                  <Button type="button" size="sm" onClick={createTag}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setCreatingTag(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  id="import-tag"
                  value={tagId}
                  onChange={(e) => (e.target.value === "__new__" ? setCreatingTag(true) : setTagId(e.target.value))}
                >
                  <option value="">No tag</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="__new__">+ Create new tag…</option>
                </Select>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <Button onClick={handleImport} disabled={saving || validRows.length === 0} className="flex-1">
                {saving ? "Importing…" : `Import ${validRows.length} contact${validRows.length === 1 ? "" : "s"}`}
              </Button>
              <Button variant="secondary" onClick={() => setParsed(null)} disabled={saving}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
