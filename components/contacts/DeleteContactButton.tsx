"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Trash2 } from "lucide-react";

// Permanent, unlike Archive: the contact and everything attached to them
// (timeline, tasks, tags, notes) is removed by the database's cascades.
// Two-step confirm that names the person, so it can't be a stray click.
export function DeleteContactButton({ contactId, contactName }: { contactId: string; contactName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    const supabase = createClient();
    const { data, error: deleteError } = await supabase.from("contacts").delete().eq("id", contactId).select("id");
    if (deleteError || !data?.length) {
      setError(deleteError?.message ?? "Nothing was deleted - the contact may already be gone, or you don't have access.");
      setDeleting(false);
      return;
    }
    router.push("/contacts");
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-600">
          Permanently delete {contactName || "this contact"} and their whole history? This can&apos;t be undone.
        </span>
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete forever"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </Button>
        {error && <p className="w-full text-xs text-red-600">Couldn&apos;t delete: {error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 active:scale-[0.98]"
    >
      <Trash2 size={15} /> Delete
    </button>
  );
}
