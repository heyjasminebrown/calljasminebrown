"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";
import { formatLocal } from "@/lib/format-time";
import { fullName } from "@/lib/utils";
import { Pause, Play, X, UserPlus } from "lucide-react";
import { EnrollContactModal } from "@/components/sequences/EnrollContactModal";
import type { DripEnrollmentDetail } from "@/lib/data/sequences";

type SimpleContact = { id: string; first_name: string; last_name: string; email: string | null };

export function EnrollmentManager({
  sequenceId,
  enrollments,
  candidateContacts,
}: {
  sequenceId: string;
  enrollments: DripEnrollmentDetail[];
  candidateContacts: SimpleContact[];
}) {
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function togglePause(enrollment: DripEnrollmentDetail) {
    setBusyId(enrollment.id);
    setError(null);
    const supabase = createClient();
    const { error: toggleError } = await supabase
      .from("email_sequence_enrollments")
      .update({ status: enrollment.status === "paused" ? "active" : "paused" })
      .eq("id", enrollment.id);
    setBusyId(null);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    router.refresh();
  }

  async function remove(enrollment: DripEnrollmentDetail) {
    if (
      !confirm(
        `Remove ${enrollment.contact ? fullName(enrollment.contact) : "this contact"} from the sequence? Their send history stays on record.`,
      )
    )
      return;
    setBusyId(enrollment.id);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("email_sequence_enrollments").delete().eq("id", enrollment.id);
    setBusyId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  const enrolledIds = new Set(enrollments.map((e) => e.contact_id));
  const available = candidateContacts.filter((c) => !enrolledIds.has(c.id));

  return (
    <div className="space-y-2">
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {enrollments.length === 0 && (
        <Card className="text-sm text-neutral-500">
          No one&apos;s enrolled yet — they&apos;ll join automatically when tagged, or add someone manually below.
        </Card>
      )}
      {enrollments.map((e) => (
        <Card key={e.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-neutral-900">{e.contact ? fullName(e.contact) : "Unknown contact"}</p>
            <p className="text-xs text-neutral-500">
              Step {Math.min(e.current_step + 1, e.totalSteps)} of {e.totalSteps}
              {e.status === "completed" && " · Completed"}
              {e.status === "paused" && " · Paused"}
              {e.excluded && " · Unsubscribed"}
              {e.status === "active" && !e.excluded && e.nextSendAt && ` · Next: ${formatLocal(e.nextSendAt, "MMM d 'at' h:mm a")}`}
            </p>
          </div>
          {e.status !== "completed" && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => togglePause(e)}
                disabled={busyId === e.id}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
                aria-label={e.status === "paused" ? "Resume" : "Pause"}
              >
                {e.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
              </button>
              <button
                onClick={() => remove(e)}
                disabled={busyId === e.id}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </Card>
      ))}

      {enrolling ? (
        <EnrollContactModal
          sequenceId={sequenceId}
          candidates={available}
          onClose={() => {
            setEnrolling(false);
            router.refresh();
          }}
        />
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setEnrolling(true)}>
          <UserPlus size={14} /> Enroll a contact manually
        </Button>
      )}
    </div>
  );
}
