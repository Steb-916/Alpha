"use client";

import { regimeColor } from "@/lib/analytics/regime";

interface RegimeBadgeProps {
  label: string | null | undefined;
  size?: "sm" | "md";
}

const LABELS: Record<string, string> = {
  extreme_fear: "Extreme Fear",
  bearish: "Bearish",
  cautious: "Cautious",
  neutral: "Neutral",
  optimistic: "Optimistic",
  bullish: "Bullish",
  euphoria: "Euphoria",
  // Legacy v1 labels
  "Risk Off": "Risk Off",
  Cautious: "Cautious",
  Neutral: "Neutral",
  "Risk On": "Risk On",
  Overheated: "Overheated",
};

export function RegimeBadge({ label, size = "sm" }: RegimeBadgeProps) {
  if (!label) return null;
  const color = regimeColor(label);
  const display = LABELS[label] ?? label;
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-block rounded-[var(--radius-pill)] font-mono uppercase tracking-wider ${pad}`}
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {display}
    </span>
  );
}
