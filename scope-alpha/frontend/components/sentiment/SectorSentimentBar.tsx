"use client";

import type { SectorGroup } from "@/types/sentiment";

interface Props {
  sectors: SectorGroup[];
}

const BIAS_COLOR: Record<string, string> = {
  bullish: "#22c55e",
  slightly_bullish: "#86efac",
  neutral: "#94a3b8",
  slightly_bearish: "#fca5a5",
  bearish: "#ef4444",
};

const BIAS_LABEL: Record<string, string> = {
  bullish: "Bullish",
  slightly_bullish: "Sl. Bullish",
  neutral: "Neutral",
  slightly_bearish: "Sl. Bearish",
  bearish: "Bearish",
};

export function SectorSentimentBar({ sectors }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {sectors.map((sector) => {
        const color = BIAS_COLOR[sector.bias] ?? "#94a3b8";
        const label = BIAS_LABEL[sector.bias] ?? sector.bias;
        // score is -1..+1; map to bar width 0..100%
        const barPct = ((sector.score + 1) / 2) * 100;

        return (
          <div key={sector.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold tracking-wider uppercase"
                  style={{ color: "var(--text-primary)" }}
                >
                  {sector.name}
                </span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {sector.assets.map((a) => a.symbol).join(", ")}
                </span>
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color }}
              >
                {label}
              </span>
            </div>

            {/* Bar track */}
            <div
              className="relative h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-elevated)" }}
            >
              {/* Neutral midline */}
              <div
                className="absolute top-0 h-full w-px opacity-40"
                style={{ left: "50%", background: "var(--text-muted)" }}
              />
              {/* Fill */}
              <div
                className="absolute top-0 h-full rounded-full transition-all duration-500"
                style={{
                  left: sector.score >= 0 ? "50%" : `${barPct}%`,
                  width: `${Math.abs(sector.score) * 50}%`,
                  background: color,
                }}
              />
            </div>

            <div
              className="flex justify-between text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              <span>avg funding {(sector.avg_funding * 100).toFixed(4)}%</span>
              <span>score {sector.score >= 0 ? "+" : ""}{sector.score.toFixed(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
