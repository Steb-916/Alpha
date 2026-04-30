"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useStablecoinFlows } from "@/hooks/useOnChain";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtBig(v: number): string {
  if (Math.abs(v) >= 1e9) return `${v >= 0 ? "+" : ""}$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${v >= 0 ? "+" : ""}$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${v >= 0 ? "+" : ""}$${(v / 1e3).toFixed(0)}K`;
  return `${v >= 0 ? "+" : ""}$${v.toFixed(0)}`;
}

export function StablecoinFlowChart() {
  const { data, isLoading, error } = useStablecoinFlows();

  const chart = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const pts = data.points;
    const maxAbs = Math.max(...pts.map((p) => Math.abs(p.combinedNetFlowUsd ?? 0)), 1);
    return { pts, maxAbs };
  }, [data]);

  if (isLoading) {
    return <GlassCard><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p></GlassCard>;
  }

  if (error || !data || !chart) {
    return (
      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Stablecoin flow data not yet available. Trigger <code style={{ color: "var(--accent-green)" }}>/api/cron/refresh-onchain</code>.
        </p>
      </GlassCard>
    );
  }

  const trend = data.summary.trend;
  const trendColor = trend === "inflow" ? "var(--accent-green)" : trend === "outflow" ? "var(--data-red)" : "var(--data-yellow)";
  const trendLabel = trend === "inflow"
    ? "Stablecoins flowing onto exchanges — potential buy pressure"
    : trend === "outflow"
    ? "Stablecoins leaving exchanges — potential selling/DeFi rotation"
    : "Balanced stablecoin flow";

  const W = 580;
  const H = 120;
  const BAR_W = Math.max(2, Math.floor((W - 20) / chart.pts.length) - 1);

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
        Stablecoin Exchange Flows
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Trend (7d)</div>
          <div className="text-sm font-bold font-mono" style={{ color: trendColor }}>{trendLabel}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>USDT Net (7d)</div>
          <div className="text-lg font-bold font-mono" style={{ color: data.summary.usdtNetFlow7d >= 0 ? "var(--accent-green)" : "var(--data-red)" }}>
            {fmtBig(data.summary.usdtNetFlow7d)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>USDC Net (7d)</div>
          <div className="text-lg font-bold font-mono" style={{ color: data.summary.usdcNetFlow7d >= 0 ? "var(--accent-green)" : "var(--data-red)" }}>
            {fmtBig(data.summary.usdcNetFlow7d)}
          </div>
        </GlassCard>
      </div>

      {/* Net flow bar chart */}
      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Combined Net Stablecoin Flow to Exchanges (30d)
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 360 }}>
            <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--glass-border)" strokeWidth={1} />
            {chart.pts.map((p, i) => {
              const net = p.combinedNetFlowUsd ?? 0;
              const barH = Math.abs(net) / chart.maxAbs * (H / 2 - 4);
              const isPos = net >= 0;
              const x = 10 + i * (BAR_W + 1);
              const y = isPos ? H / 2 - barH : H / 2;
              return (
                <rect key={i} x={x} y={y} width={BAR_W} height={Math.max(1, barH)}
                  fill={isPos ? "rgba(0,212,170,0.6)" : "rgba(239,68,68,0.6)"} rx={1}>
                  <title>{`${p.timestamp.slice(0, 10)}: ${fmtBig(net)}`}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        <div className="flex gap-4 mt-1 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(0,212,170,0.6)" }} />Net Inflow</span>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(239,68,68,0.6)" }} />Net Outflow</span>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Stablecoin exchange inflows indicate dry powder accumulating on exchanges, which may precede buying activity. Outflows may indicate capital rotating to DeFi or cold storage.
        </p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
