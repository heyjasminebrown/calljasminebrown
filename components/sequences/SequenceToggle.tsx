"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Pause, Play, Trash2 } from "lucide-react";

export function SequenceToggle({ sequenceId, active }: { sequenceId: string; active: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: toggleError } = await supabase.from("email_sequences").update({ active: !active }).eq("id", sequenceId);
    setSaving(false);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this sequence? Its steps and send history go with it.")) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("email_sequences").delete().eq("id", sequenceId);
    if (deleteError) {
      setSaving(false);
      setError(deleteError.message);
      return;
    }
    router.push("/sequences");
  }

  return (
    <div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={toggle} disabled={saving}>
          {active ? (
            <>
              <Pause size={14} /> Pause
            </>
          ) : (
            <>
              <Play size={14} /> Resume
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving}>
          <Trash2 size={14} />
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
