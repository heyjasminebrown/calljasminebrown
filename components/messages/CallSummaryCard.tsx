"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

export function CallSummaryCard({
  bullets,
  nextSteps,
  transcript,
}: {
  bullets: string[];
  nextSteps: string[];
  transcript?: string | null;
}) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="w-full max-w-xs rounded-2xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-900">Call summary</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
          <Sparkles size={11} /> Powered by AI
        </span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-1.5 text-xs text-neutral-700">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {nextSteps.length > 0 && (
        <div className="mt-3 border-t border-neutral-100 pt-2.5">
          <p className="text-xs font-semibold text-neutral-900">Next steps</p>
          <ul className="mt-1.5 space-y-1.5">
            {nextSteps.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-neutral-700">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {transcript && (
        <div className="mt-3 border-t border-neutral-100 pt-2.5">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600"
          >
            View transcript
            {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showTranscript && (
            <p className="mt-2 max-w-full whitespace-pre-wrap break-words rounded-xl bg-neutral-50 p-2.5 text-xs text-neutral-600">
              {transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
