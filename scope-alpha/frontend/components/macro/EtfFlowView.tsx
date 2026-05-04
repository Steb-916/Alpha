"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useEtfFlows } from "@/hooks/useMacro";
import type { EtfTicker } from "@/types/macro";

const ETF_COLORS: Record<EtfTicker, string> = {
  IBIT:  "var(--accent-green)",
  FBTC:  "var(--data-blue)",
  ARKB:  "var(--data-yellow)",
  BITB:  "#a78bfa",
  HODL:  "#f472b6",
};

function fmtM(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
}

const CHART_W = 540;
const CHART_H = 100;
const BAR_GAP = 1;

export function EtfFlowView() {
  const { data, isLoading, error } = useEtfFlows();
  const [days, setDays] = useState<7 | 30 | 90>(30);

  if (isLoading) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Loading ETF flow data…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          ETF flow data unavailable.
        </p>
      </GlassCard>
    );
  }

  const trendColor =
    data.summary.trend === "inflow"
      ? "var(--accent-green)"
      : data.summary.trend === "outflow"
      ? "var(--data-red)"
      : "var(--data-yellow)";

  const tradingDays = data.dailyFlows.filter((d) => d.totalFlow !== 0);
  const slice = tradingDays.slice(-days);
  const maxAbs = Math.max(...slice.map((d) => Math.abs(d.totalFlow)), 1);
  const barW = Math.max(3, (CHART_W - (slice.length - 1) * BAR_GAP) / slice.length);
  const scaleY = (v: number) => (Math.abs(v) / maxAbs) * (CHART_H / 2);

  // Cumulative line
  const cumSlice = data.cumulative.slice(-days * 1.5).slice(-days);
  const cumMin = Math.min(...cumSlice.map((c) => c.totalCumulative));
  const cumMax = Math.max(...cumSlice.map((c) => c.totalCumulative));
  const cumRange = cumMax - cumMin || 1;
  const cumPoints = cumSlice
    .map((c, i) => {
      const x = (i / (cumSlice.length - 1)) * CHART_W;
      const y = CHART_H - ((c.totalCumulative - cumMin) / cumRange) * CHART_H;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Net Flow MTD", value: fmtM(data.summary.totalFlowMtd), color: data.summary.totalFlowMtd >= 0 ? "var(--accent-green)" : "var(--data-red)" },
          { label: "All-Time Cumulative", value: fmtM(data.summary.totalFlowAllTime), color: "var(--text-primary)" },
          { label: "Recent Trend", value: data.summary.trend.toUpperCase(), color: trendColor },
        ].map((card) => (
          <GlassCard key={card.label}>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </p>
            <p className="text-lg font-mono font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Daily bars */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Daily Bitcoin ETF Flows
          </h3>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="px-2 py-0.5 text-[10px] font-mono rounded"
                style={{
                  background: days === d ? "rgba(0,212,170,0.12)" : "transparent",
                  border: days === d ? "1px solid var(--accent-green)" : "1px solid var(--glass-border)",
                  color: days === d ? "var(--accent-green)" : "var(--text-muted)",
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg width={CHART_W} height={CHART_H + 8} viewBox={`0 0 ${CHART_W} ${CHART_H + 8}`}>
            {/* Zero line */}
            <line x1={0} y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} stroke="var(--glass-border)" strokeWidth={0.5} />
            {slice.map((d, i) => {
              const h = scaleY(d.totalFlow);
              const x = i * (barW + BAR_GAP);
              const isPos = d.totalFlow >= 0;
              const y = isPos ? CHART_H / 2 - h : CHART_H / 2;
              return (
                <rect
                  key={d.date}
                  x={x} y={y} width={barW} height={h || 1}
                  fill={isPos ? "var(--accent-green)" : "var(--data-red)"}
                  opacity={0.8}
                >
                  <title>{`${d.date}: ${fmtM(d.totalFlow)}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        {/* ETF legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {(Object.keys(ETF_COLORS) as EtfTicker[]).map((ticker) => (
            <div key={ticker} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: ETF_COLORS[ticker] }} />
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{ticker}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Cumulative line */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Cumulative Bitcoin ETF AUM Flows
          </h3>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
          >
            Seeded Data
          </span>
        </div>
        {cumSlice.length > 1 ? (
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="xMidYMid meet">
            <polyline points={cumPoints} fill="none" stroke="var(--accent-green)" strokeWidth={1.5} />
            {/* Y extremes */}
            <text x={4} y={10} fontSize={9} fontFamily="monospace" fill="var(--text-muted)">{fmtM(cumMax)}</text>
            <text x={4} y={CHART_H - 2} fontSize={9} fontFamily="monospace" fill="var(--text-muted)">{fmtM(cumMin)}</text>
          </svg>
        ) : (
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Insufficient data.</p>
        )}
      </GlassCard>
    </div>
  );
}
