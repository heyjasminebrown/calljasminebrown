"use client";

import { useState } from "react";

export type ConnectionRow = {
  key: string;
  name: string;
  description: string;
  status: string;
  connected: boolean;
  manageContent: React.ReactNode;
};

function ConnectionRowItem({ row }: { row: ConnectionRow }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-100 py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-neutral-900">{row.name}</p>
          <p className="mt-0.5 text-[15px] leading-[22px] text-neutral-600">{row.description}</p>
        </div>
        <span className={`shrink-0 text-[15px] ${row.connected ? "font-semibold text-neutral-600" : "text-neutral-400"}`}>{row.status}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-neutral-800"
        >
          {open ? "Close" : "Manage"}
        </button>
      </div>
      {open && <div className="mt-3.5">{row.manageContent}</div>}
    </div>
  );
}

export function ConnectionsCard({ rows }: { rows: ConnectionRow[] }) {
  return (
    <div className="rounded-2xl border border-[#ebe9e7] bg-white p-[18px]">
      <p className="text-base font-semibold text-neutral-900">Connections</p>
      <div className="mt-3.5">
        {rows.map((row) => (
          <ConnectionRowItem key={row.key} row={row} />
        ))}
      </div>
      <p className="mt-3.5 text-[15px] leading-[22px] text-neutral-500">The webhook URL, matching rules and backfills live behind each Manage.</p>
    </div>
  );
}
