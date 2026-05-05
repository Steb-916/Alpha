"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRegimeOverview } from "@/hooks/useMacro";
import type { MacroRegimeLabel, RegimeOverviewItem } from "@/types/macro";

const REGIME_COLORS: Record<MacroRegimeLabel, string> = {
  "Risk-On":      "var(--accent-green)",
  "Risk-Off":     "var(--data-red)",
  "Accumulation": "var(--data-blue)",
  "Distribution": "var(--data-yellow)",
  "Volatile":     "#f97316",
  "Compressed":   "#a78bfa",
};

const REGIME_ICONS: Record<MacroRegimeLabel, string> = {
  "Risk-On":      "↑",
  "Risk-Off":     "↓",
  "Accumulation": "◎",
  "Distribution": "◉",
  "Volatile":     "⚡",
  "Compressed":   "◈",
};

function AssetCell({ item }: { item: RegimeOverviewItem }) {
  const color = REGIME_COLORS[item.regime];
  const pct = item.priceChange24h;
  const pctColor = pct == null ? "var(--text-muted)" : pct >= 0 ? "var(--accent-green)" : "var(--data-red)";

  return (
    <div
      className="flex flex-col gap-1 p-3 rounded-[var(--radius-sm)] transition-colors"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}25`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold" style={{ color: "var(--text-primary)" }}>
          {item.asset}
        </span>
        {pct != null && (
          <span className="text-[10px] font-mono" style={{ color: pctColor }}>
            {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm" style={{ color }}>{REGIME_ICONS[item.regime]}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color }}>
          {item.regime}
        </span>
      </div>
      {/* Confidence bar */}
      <div className="h-0.5 rounded-full" style={{ background: "var(--glass-border)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${item.confidence}%`, background: color, opacity: 0.6 }}
        />
      </div>
      <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
        {item.confidence}% conf
      </span>
    </div>
  );
}

export function RegimeOverview() {
  const { data, isLoading, error } = useRegimeOverview();

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Loading regime overview…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) return null;

  // Tally regime distribution
  const tally: Partial<Record<MacroRegimeLabel, number>> = {};
  for (const item of data.items) {
    tally[item.regime] = (tally[item.regime] ?? 0) + 1;
  }
  const dominantRegime = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as MacroRegimeLabel | null;

  return (
    <GlassCard noPadding>
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <div>
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Multi-Asset Regime Overview
          </h3>
          {dominantRegime && (
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
              Dominant:{" "}
              <span style={{ color: REGIME_COLORS[dominantRegime] }}>
                {dominantRegime} ({tally[dominantRegime]}/{data.items.length} assets)
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(Object.entries(tally) as [MacroRegimeLabel, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([regime, count]) => (
              <span
                key={regime}
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  background: `${REGIME_COLORS[regime]}14`,
                  color: REGIME_COLORS[regime],
                  border: `1px solid ${REGIME_COLORS[regime]}30`,
                }}
              >
                {REGIME_ICONS[regime]} {regime} ×{count}
              </span>
            ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 p-4">
        {data.items.map((item) => (
          <Link key={item.asset} href={`/terminal/macro?view=regime`}>
            <AssetCell item={item} />
          </Link>
        ))}
      </div>
      <div
        className="px-4 py-2 border-t"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <p className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
          BTC &amp; ETH: full multi-domain regime · Others: simplified funding + price signal ·{" "}
          Updated {new Date(data.computedAt).toLocaleTimeString()}
        </p>
      </div>
    </GlassCard>
  );
}
