import { Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { formatLocal } from "@/lib/format-time";
import { AudioPlayer } from "@/components/messages/AudioPlayer";
import { CallSummaryCard } from "@/components/messages/CallSummaryCard";
import type { Activity } from "@/types/database";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asCallSummary(v: unknown): { bullets: string[]; nextSteps: string[] } | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as { bullets?: unknown; nextSteps?: unknown };
  if (!Array.isArray(obj.bullets) || !obj.bullets.length) return null;
  return { bullets: obj.bullets as string[], nextSteps: Array.isArray(obj.nextSteps) ? (obj.nextSteps as string[]) : [] };
}

export function CallLogEntry({ activity }: { activity: Activity }) {
  const Icon = activity.direction === "inbound" ? PhoneIncoming : activity.direction === "outbound" ? PhoneOutgoing : Phone;
  const recordingUrl = asString(activity.metadata?.recording_url);
  const transcript = asString(activity.metadata?.transcript);
  const callSummary = asCallSummary(activity.metadata?.ai_call_summary);

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {/* Mobile: full-width card, not a small pill */}
      <div className="flex w-full items-center gap-3 rounded-[16px] border border-[#ebe9e7] bg-white px-3.5 py-3 lg:hidden">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-neutral-900">{activity.body ?? "Call"}</p>
          <p className="truncate text-[13px] text-neutral-400">
            {formatLocal(activity.occurred_at, "h:mm a")}
            {recordingUrl && " · recording"}
            {callSummary && " · summary below"}
          </p>
        </div>
      </div>

      {/* Desktop: unchanged small pill */}
      <div className="hidden max-w-full items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-1.5 text-xs text-neutral-600 lg:flex">
        <Icon size={13} className="shrink-0 text-neutral-400" />
        <span className="min-w-0 truncate">{activity.body ?? "Call"}</span>
        <span className="shrink-0 text-neutral-400">· {formatLocal(activity.occurred_at, "h:mm a")}</span>
      </div>

      {recordingUrl && (
        <div className="w-full max-w-xs">
          <AudioPlayer src={recordingUrl} />
        </div>
      )}

      {callSummary ? (
        <CallSummaryCard bullets={callSummary.bullets} nextSteps={callSummary.nextSteps} transcript={transcript} />
      ) : (
        transcript && (
          <details className="w-full max-w-xs">
            <summary className="cursor-pointer text-xs font-medium text-brand-600">Transcript</summary>
            <p className="mt-1.5 max-w-full break-words whitespace-pre-wrap rounded-xl bg-neutral-50 p-2.5 text-left text-xs text-neutral-600">
              {transcript}
            </p>
          </details>
        )
      )}
    </div>
  );
}
