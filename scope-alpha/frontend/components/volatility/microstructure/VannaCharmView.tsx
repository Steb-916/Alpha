"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPill } from "@/components/ui/GlassPill";
import { useVannaCharm } from "@/hooks/useVannaCharm";
import { UnavailableBanner } from "../UnavailableBanner";
import type { VannaCharmStrike } from "@/types/options";

type Mode = "vanna" | "charm" | "combined";
const MODE_ITEMS = [
  { label: "Vanna", value: "vanna" },
  { label: "Charm", value: "charm" },
  { label: "Combined", value: "combined" },
];

const BAR_HEIGHT = 12;
const BAR_GAP = 3;
const LABEL_W = 72;
const CHART_W = 500;
const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

const EXPLANATIONS: Record<Mode, string> = {
  vanna:
    "Vanna measures how delta changes with implied volatility. High vanna exposure near key strikes may suggest that a move in IV — even without a price move — could force dealers to re-hedge their positions.",
  charm:
    "Charm measures how delta changes with time (theta decay of delta). As expiration approaches, charm accelerates. Elevated charm exposure near expiry may suggest increasing hedging activity even without a price or IV change.",
  combined:
    "Combined vanna and charm exposure indicates strikes where dealer re-hedging may be forced by both IV changes and time decay. These levels may see elevated volatility near expiration.",
};

interface Props { asset: string }

export function VannaCharmView({ asset }: Props) {
  const [mode, setMode] = useState<Mode>("vanna");
  const { data, isLoading, unavailable, quantEngineConfigured } = useVannaCharm(asset);

  const chart = useMemo(() => {
    if (!data || data.strikes.length === 0) return null;

    const getValue = (s: VannaCharmStrike): number => {
      if (mode === "vanna") return s.vanna;
      if (mode === "charm") return s.charm;
      return s.vanna + s.charm;
    };

    // Aggregate by strike across all expirations
    const byStrike = new Map<number, number>();
    for (const s of data.strikes) {
      byStrike.set(s.strike, (byStrike.get(s.strike) ?? 0) + getValue(s));
    }
    const entries = Array.from(byStrike.entries())
      .map(([strike, val]) => ({ strike, val }))
      .sort((a, b) => a.strike - b.strike);

    const maxAbs = Math.max(...entries.map((e) => Math.abs(e.val)), 1);
    return { entries, maxAbs };
  }, [data, mode]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data || !chart) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="Vanna/Charm" />;
  }

  const netValue = mode === "vanna" ? data.vannaNet : mode === "charm" ? data.charmNet : data.vannaNet + data.charmNet;
  const svgH = chart.entries.length * (BAR_HEIGHT + BAR_GAP) + 10;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Vanna / Charm Exposure — {asset}
        </h2>
        <GlassPill items={MODE_ITEMS} activeValue={mode} onChange={(v) => setMode(v as Mode)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Net {mode.charAt(0).toUpperCase() + mode.slice(1)}</div>
          <div className="text-xl font-bold font-mono" style={{ color: netValue >= 0 ? "var(--accent-green)" : "var(--data-red)" }}>
            {netValue >= 0 ? "+" : ""}{netValue.toExponential(2)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Mode</div>
          <div className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
            {mode === "vanna" && "IV sensitivity"}
            {mode === "charm" && "Time decay of delta"}
            {mode === "combined" && "IV + time combined"}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          {mode.charAt(0).toUpperCase() + mode.slice(1)} Exposure by Strike (OI-weighted)
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
          <svg viewBox={`0 0 ${LABEL_W + CHART_W + 60} ${svgH}`} className="w-full">
            <line x1={LABEL_W + CHART_W / 2} y1={0} x2={LABEL_W + CHART_W / 2} y2={svgH}
              stroke="var(--glass-border)" strokeWidth={1} />
            {chart.entries.map((e, i) => {
              const y = i * (BAR_HEIGHT + BAR_GAP) + 3;
              const barW = Math.abs(e.val) / chart.maxAbs * (CHART_W / 2 - 4);
              const isPos = e.val >= 0;
              const barX = isPos ? LABEL_W + CHART_W / 2 : LABEL_W + CHART_W / 2 - barW;
              return (
                <g key={e.strike}>
                  <text x={LABEL_W - 4} y={y + BAR_HEIGHT - 2} textAnchor="end" fontSize={9} fill="var(--text-muted)">
                    {e.strike >= 1000 ? `${(e.strike / 1000).toFixed(0)}k` : e.strike}
                  </text>
                  <rect x={barX} y={y} width={Math.max(barW, 1)} height={BAR_HEIGHT}
                    fill={isPos ? "rgba(147,51,234,0.55)" : "rgba(249,115,22,0.55)"} rx={2} />
                </g>
              );
            })}
          </svg>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>{EXPLANATIONS[mode]}</p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
