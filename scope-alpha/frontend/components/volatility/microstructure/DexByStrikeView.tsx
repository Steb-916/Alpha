"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useDex } from "@/hooks/useDex";
import { UnavailableBanner } from "../UnavailableBanner";

const BAR_HEIGHT = 14;
const BAR_GAP = 3;
const LABEL_W = 72;
const CHART_W = 500;
const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

interface Props { asset: string }

export function DexByStrikeView({ asset }: Props) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useDex(asset);

  const chart = useMemo(() => {
    if (!data || data.strikes.length === 0) return null;
    const maxAbs = Math.max(...data.strikes.map((s) => Math.abs(s.netDex)), 1);
    return { maxAbs };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data || !chart) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="DEX" />;
  }

  const regimeLabel: Record<string, string> = {
    "call-heavy": "Call-Heavy (bullish directional pressure)",
    "put-heavy": "Put-Heavy (bearish directional pressure)",
    "balanced": "Balanced (no dominant directional bias)",
  };
  const regimeColor: Record<string, string> = {
    "call-heavy": "var(--accent-green)",
    "put-heavy": "var(--data-red)",
    "balanced": "var(--data-yellow)",
  };

  const largestPos = data.strikes.reduce((best, s) => s.netDex > best.netDex ? s : best, data.strikes[0]);
  const largestNeg = data.strikes.reduce((best, s) => s.netDex < best.netDex ? s : best, data.strikes[0]);

  const svgH = data.strikes.length * (BAR_HEIGHT + BAR_GAP) + 10;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Delta Exposure by Strike — {asset}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Net DEX</div>
          <div className="text-xl font-bold font-mono" style={{ color: regimeColor[data.deltaRegime] }}>
            {fmtUsd(data.totalNetDex)}
          </div>
          <div className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            {regimeLabel[data.deltaRegime]}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Largest Exposure</div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-mono" style={{ color: "var(--accent-green)" }}>
              ▲ ${largestPos.strike.toLocaleString()} ({fmtUsd(largestPos.netDex)})
            </div>
            <div className="text-xs font-mono" style={{ color: "var(--data-red)" }}>
              ▼ ${largestNeg.strike.toLocaleString()} ({fmtUsd(largestNeg.netDex)})
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Net Delta Exposure by Strike (dealer directional hedge pressure)
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          <svg viewBox={`0 0 ${LABEL_W + CHART_W + 60} ${svgH}`} className="w-full">
            <line x1={LABEL_W + CHART_W / 2} y1={0} x2={LABEL_W + CHART_W / 2} y2={svgH}
              stroke="var(--glass-border)" strokeWidth={1} />
            {data.strikes.map((s, i) => {
              const y = i * (BAR_HEIGHT + BAR_GAP) + 4;
              const barW = Math.abs(s.netDex) / chart.maxAbs * (CHART_W / 2 - 4);
              const isPos = s.netDex >= 0;
              const barX = isPos ? LABEL_W + CHART_W / 2 : LABEL_W + CHART_W / 2 - barW;
              const isNearSpot = data.spot > 0 && Math.abs(s.strike - data.spot) / data.spot < 0.02;
              return (
                <g key={s.strike}>
                  <text x={LABEL_W - 4} y={y + BAR_HEIGHT - 2} textAnchor="end" fontSize={9}
                    fill={isNearSpot ? "var(--text-primary)" : "var(--text-muted)"}>
                    {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}k` : s.strike}
                  </text>
                  <rect x={barX} y={y} width={Math.max(barW, 1)} height={BAR_HEIGHT}
                    fill={isPos ? "rgba(0,212,170,0.5)" : "rgba(239,68,68,0.5)"} rx={2} />
                </g>
              );
            })}
          </svg>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Delta exposure shows where directional hedging pressure is concentrated. Positive DEX suggests options positioning skewed toward upside exposure; negative DEX toward downside exposure.
        </p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
