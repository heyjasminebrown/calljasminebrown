import { createClient } from "@/lib/supabase/server";
import { DismissErrorButton } from "@/components/system/DismissErrorButton";
import { AlertTriangle } from "lucide-react";

const SHOWN = 5;

// Every open background failure (see lib/errors/report-failure.ts), with
// the exact error up front. Renders nothing when there are none.
export async function SystemErrorsBanner() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_errors")
    .select("id, message, details, occurrences, last_seen_at")
    .is("resolved_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(SHOWN + 1);

  if (error) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p className="font-semibold">Couldn&apos;t load the error log: {error.message}</p>
        <p className="mt-0.5">
          If this says the table doesn&apos;t exist, run <code>supabase/migrations/0082_system_errors.sql</code> in the Supabase SQL Editor.
        </p>
      </div>
    );
  }
  if (!data || data.length === 0) return null;

  const shown = data.slice(0, SHOWN);
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={16} className="shrink-0" />
          {data.length > SHOWN ? `${SHOWN}+ things failed` : `${data.length} thing${data.length === 1 ? "" : "s"} failed`} in the background
        </p>
        {data.length > 1 && <DismissErrorButton label="Dismiss all" />}
      </div>
      <ul className="mt-2 space-y-2">
        {shown.map((e) => (
          <li key={e.id} className="rounded-xl border border-red-200 bg-white/70 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium">{e.message}</p>
              <DismissErrorButton id={e.id} label="Dismiss" />
            </div>
            <p className="mt-0.5 text-xs text-red-700/80">
              {e.occurrences > 1 ? `${e.occurrences} times, last ` : ""}
              {new Date(e.last_seen_at).toLocaleString()}
            </p>
            {e.details && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs font-medium">Full details</summary>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 text-[11px] text-neutral-800">
                  {e.details}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
