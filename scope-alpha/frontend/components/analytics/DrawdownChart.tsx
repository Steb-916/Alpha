"use client";

/**
 * Pure-SVG drawdown area chart. Matches the visual style of
 * `components/analyst/PerformanceCharts.tsx` (CumulativePnlChart) so the
 * two sit cleanly side-by-side on the analyst page.
 *
 * Drawdown values are negative (or zero). The chart inverts the area fill
 * downward from the zero line, in red.
 */

import type { DrawdownPoint } from "@/lib/analytics/drawdown";

interface Props {
  data: DrawdownPoint[];
  maxDrawdownPct: number;
}

export function DrawdownChart({ data, maxDrawdownPct }: Props) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center h-[180px] rounded-[var(--radius-md)]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          Not enough data for drawdown chart
        </span>
      </div>
    );
  }

  const W = 500;
  const H = 160;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };

  // Drawdown values are <= 0. The chart's y-axis runs from 0 (top) to
  // maxDrawdownPct (bottom).
  const minVal = Math.min(maxDrawdownPct, ...data.map((d) => d.drawdownPct), 0);
  const maxVal = 0;
  const range = maxVal - minVal || 1;

  const xScale = (i: number) =>
    PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (v: number) =>
    PAD.top + (1 - (v - minVal) / range) * (H - PAD.top - PAD.bottom);

  const zeroY = yScale(0);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.drawdownPct)}`)
    .join(" ");
  const fillPath = `${linePath} L ${xScale(data.length - 1)} ${zeroY} L ${xScale(0)} ${zeroY} Z`;

  return (
    <div
      className="rounded-[var(--radius-md)] p-3"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Drawdown
        </span>
        <span
          className="text-[10px] font-mono font-bold"
          style={{ color: "#EF4444" }}
        >
          Max: {maxDrawdownPct.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {/* Zero line */}
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="var(--glass-border)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Fill area */}
        <path d={fillPath} fill="rgba(239, 68, 68, 0.12)" />

        {/* Drawdown line */}
        <path d={linePath} fill="none" stroke="#EF4444" strokeWidth={2} />

        {/* Y-axis labels */}
        <text
          x={PAD.left - 8}
          y={PAD.top + 4}
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          0%
        </text>
        <text
          x={PAD.left - 8}
          y={H - PAD.bottom}
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          {minVal.toFixed(1)}%
        </text>
      </svg>
    </div>
  );
}
