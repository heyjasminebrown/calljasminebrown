"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Archive, ArchiveRestore } from "lucide-react";

// Archiving had no undo anywhere in the app - a fat-fingered archive (or a
// bulk one, see ContactsList's bulk action) was permanent from the UI's
// perspective even though the row itself never actually gets deleted.
// Same button now does both jobs, switching on the contact's current
// state, so "Restore" is reachable from the exact same spot "Archive" is.
export function ArchiveButton({ contactId, archived }: { contactId: string; archived: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("contacts").update({ archived: !archived }).eq("id", contactId);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    if (!archived) router.push("/contacts");
    router.refresh();
  }

  if (archived) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={handleToggle} disabled={saving}>
          <ArchiveRestore size={15} /> {saving ? "Restoring…" : "Restore"}
        </Button>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Archive this contact?</span>
        <Button variant="danger" size="sm" onClick={handleToggle} disabled={saving}>
          {saving ? "Archiving…" : "Confirm"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      <Archive size={15} /> Archive
    </Button>
  );
}
