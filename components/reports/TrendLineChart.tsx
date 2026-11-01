"use client";

import { useState } from "react";

export type TrendPoint = { label: string; value: number | null };

// Drawn at ~1:1 with its on-screen size (about 230px wide in a 3-up grid),
// so 11px axis text stays readable.
const W = 230;
const H = 120;
const PAD = { top: 16, right: 8, bottom: 20, left: 8 };
const LINE = "#34223a";

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

// Single-series Jan-Dec trend. One series, so no legend box - the title
// names it. A null value is a month that hasn't happened yet: the line
// stops there. Hover / focus snaps a crosshair to the nearest month and
// shows the value; a hidden table carries the same numbers for screen
// readers.
export function TrendLineChart({
  title,
  points,
  format = (v: number) => String(v),
}: {
  title: string;
  points: TrendPoint[];
  format?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const max = niceMax(Math.max(0, ...values));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const drawn = points.map((p, i) => ({ ...p, i })).filter((p) => p.value != null) as { label: string; value: number; i: number }[];
  const path = drawn.map((p, n) => `${n === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = drawn.at(-1);
  const total = values.reduce((a, b) => a + b, 0);
  const shown = active != null ? points[active] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / plotW) * (points.length - 1));
    return Math.max(0, Math.min(points.length - 1, i));
  }

  return (
    <figure className="relative min-w-0 rounded-xl border border-[#ebe9e7] bg-white p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-neutral-600">{title}</span>
        <span className="shrink-0 text-[13px] text-neutral-500">
          {shown ? (
            <>
              <strong className="font-semibold text-neutral-900">{shown.value == null ? "—" : format(shown.value)}</strong> {shown.label}
            </>
          ) : (
            <>
              <strong className="font-semibold text-neutral-900">{format(total)}</strong> this year
            </>
          )}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block h-auto w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-[#a796ab]"
        role="img"
        aria-label={`${title}, by month`}
        tabIndex={0}
        onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(last?.i ?? 0)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? 1) - 1));
        }}
      >
        {/* Recessive grid: baseline and top value only. */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#e7e5e4" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(max)} y2={y(max)} stroke="#f0efee" strokeWidth={1} strokeDasharray="2 3" />
        <text x={W - PAD.right} y={y(max) - 3} textAnchor="end" fontSize={11} fill="#a8a29e">
          {format(max)}
        </text>
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 5} textAnchor="middle" fontSize={11} fill={i === active ? "#57534e" : "#a8a29e"}>
            {p.label.charAt(0)}
          </text>
        ))}
        {active != null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="#d6d3d1" strokeWidth={1} />}
        {path && <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {/* Marker on the latest month, and on the hovered month. */}
        {last && <circle cx={x(last.i)} cy={y(last.value)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />}
        {active != null && points[active].value != null && (
          <circle cx={x(active)} cy={y(points[active].value!)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
        )}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{p.value == null ? "not yet" : format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
