"use client";

import type { FearGreedPoint } from "@/types/sentiment";

interface Props {
  current: FearGreedPoint;
}

const COLORS: Record<string, string> = {
  "Extreme Fear": "#ef4444",
  Fear: "#f97316",
  Neutral: "#eab308",
  Greed: "#22c55e",
  "Extreme Greed": "#16a34a",
};

const LABELS: Record<string, string> = {
  "Extreme Fear": "Extreme Fear",
  Fear: "Fear",
  Neutral: "Neutral",
  Greed: "Greed",
  "Extreme Greed": "Extreme Greed",
};

export function FearGreedGauge({ current }: Props) {
  const { value, classification } = current;
  const color = COLORS[classification] ?? "#eab308";
  const label = LABELS[classification] ?? classification;

  // Convert 0-100 to SVG arc (180° half-circle)
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const angle = pct * 180 - 90; // -90° (left) to +90° (right)

  // Needle endpoint
  const cx = 100;
  const cy = 85;
  const r = 65;
  const rad = ((angle - 90) * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        {/* Arc segments */}
        {[
          { start: 180, end: 216, color: "#ef4444" },
          { start: 216, end: 252, color: "#f97316" },
          { start: 252, end: 288, color: "#eab308" },
          { start: 288, end: 324, color: "#22c55e" },
          { start: 324, end: 360, color: "#16a34a" },
        ].map(({ start, end, color: c }) => {
          const s = ((start - 90) * Math.PI) / 180;
          const e = ((end - 90) * Math.PI) / 180;
          const x1 = cx + 75 * Math.cos(s);
          const y1 = cy + 75 * Math.sin(s);
          const x2 = cx + 75 * Math.cos(e);
          const y2 = cy + 75 * Math.sin(e);
          return (
            <path
              key={start}
              d={`M ${cx} ${cy} L ${x1} ${y1} A 75 75 0 0 1 ${x2} ${y2} Z`}
              fill={c}
              opacity={0.85}
            />
          );
        })}
        {/* Inner circle cutout */}
        <circle cx={cx} cy={cy} r={50} fill="var(--bg-surface, #0f1117)" />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        {/* Value */}
        <text
          x={cx}
          y={cy + 20}
          textAnchor="middle"
          fill={color}
          fontSize={20}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {value}
        </text>
      </svg>
      <span
        className="text-sm font-semibold tracking-wide uppercase"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}
