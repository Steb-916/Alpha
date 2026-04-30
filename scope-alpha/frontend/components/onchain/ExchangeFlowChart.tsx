"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPill } from "@/components/ui/GlassPill";
import { useExchangeFlows } from "@/hooks/useOnChain";

const DAYS_OPTIONS = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
];

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtNative(v: number, asset: string): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K ${asset}`;
  return `${v.toFixed(2)} ${asset}`;
}

function fmtUsd(v: number | null): string {
  if (v === null) return "";
  if (Math.abs(v) >= 1e9) return ` ($${(v / 1e9).toFixed(2)}B)`;
  if (Math.abs(v) >= 1e6) return ` ($${(v / 1e6).toFixed(1)}M)`;
  return ` ($${v.toLocaleString()})`;
}

interface Props { asset: string }

export function ExchangeFlowChart({ asset }: Props) {
  const [days, setDays] = useState("30");
  const { data, isLoading, error } = useExchangeFlows(asset, parseInt(days));

  const chart = useMemo(() => {
    if (!data || data.points.length === 0) return null;

    const pts = data.points.slice(-parseInt(days));
    const maxAbs = Math.max(...pts.map((p) => Math.max(Math.abs(p.inflowNative), Math.abs(p.outflowNative))), 1);
    const maxNet = Math.max(...pts.map((p) => Math.abs(p.netFlowNative)), 1);

    return { pts, maxAbs, maxNet };
  }, [data, days]);

  if (isLoading) {
    return <GlassCard><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p></GlassCard>;
  }
  if (error || !data || !chart) {
    return (
      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Exchange flow data not yet available. Trigger <code style={{ color: "var(--accent-green)" }}>/api/cron/refresh-onchain</code> to populate.
        </p>
      </GlassCard>
    );
  }

  const trend = data.summary.trend;
  const trendColor = trend === "accumulation" ? "var(--accent-green)" : trend === "distribution" ? "var(--data-red)" : "var(--data-yellow)";
  const trendLabel = trend === "accumulation" ? "Net Accumulation (coins leaving exchanges)" : trend === "distribution" ? "Net Distribution (coins entering exchanges)" : "Balanced Flow";

  const W = 580;
  const H = 120;
  const BAR_W = Math.max(2, Math.floor((W - 20) / chart.pts.length) - 1);

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Exchange Flows — {asset}
        </h2>
        <GlassPill items={DAYS_OPTIONS} activeValue={days} onChange={setDays} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Trend</div>
          <div className="text-sm font-bold font-mono" style={{ color: trendColor }}>{trendLabel}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Net Flow ({days}d)</div>
          <div className="text-lg font-bold font-mono" style={{ color: data.summary.totalNetFlowNative >= 0 ? "var(--data-red)" : "var(--accent-green)" }}>
            {data.summary.totalNetFlowNative >= 0 ? "+" : ""}
            {fmtNative(data.summary.totalNetFlowNative, asset)}
          </div>
          <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {fmtUsd(data.summary.totalNetFlowUsd)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Latest Inflow</div>
          <div className="text-lg font-bold font-mono" style={{ color: "var(--data-red)" }}>
            {fmtNative(chart.pts[chart.pts.length - 1]?.inflowNative ?? 0, asset)}
          </div>
        </GlassCard>
      </div>

      {/* Bar chart — inflow (red) vs outflow (green) */}
      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Daily Exchange Inflow (red) vs Outflow (green) — {asset}
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H * 2 + 20}`} className="w-full" style={{ minWidth: 400 }}>
            {chart.pts.map((p, i) => {
              const x = 10 + i * (BAR_W + 1);
              const inflowH = (p.inflowNative / chart.maxAbs) * H;
              const outflowH = (p.outflowNative / chart.maxAbs) * H;
              const netH = Math.abs(p.netFlowNative) / chart.maxNet * (H - 10);
              const isNegNet = p.netFlowNative < 0;
              return (
                <g key={i}>
                  {/* Inflow bar — top half */}
                  <rect x={x} y={H - inflowH} width={BAR_W} height={inflowH}
                    fill="rgba(239,68,68,0.5)" rx={1}>
                    <title>{`${p.timestamp.slice(0, 10)}\nInflow: ${fmtNative(p.inflowNative, asset)}`}</title>
                  </rect>
                  {/* Outflow bar — bottom half */}
                  <rect x={x} y={H + 20} width={BAR_W} height={outflowH}
                    fill="rgba(0,212,170,0.5)" rx={1}>
                    <title>{`${p.timestamp.slice(0, 10)}\nOutflow: ${fmtNative(p.outflowNative, asset)}`}</title>
                  </rect>
                  {/* Net flow indicator dot */}
                  <rect x={x} y={H + 8 - (isNegNet ? netH : 0)} width={BAR_W} height={Math.max(2, netH)}
                    fill={isNegNet ? "rgba(0,212,170,0.8)" : "rgba(239,68,68,0.8)"} rx={1} />
                </g>
              );
            })}
            {/* Divider line */}
            <line x1={0} y1={H + 10} x2={W} y2={H + 10} stroke="var(--glass-border)" strokeWidth={1} />
            <text x={2} y={H + 8} fontSize={8} fill="var(--text-muted)">Inflow ↑</text>
            <text x={2} y={H + 20} fontSize={8} fill="var(--text-muted)">Outflow ↓</text>
          </svg>
        </div>
        <div className="flex gap-4 mt-1 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(239,68,68,0.5)" }} />Inflow (distribution)</span>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(0,212,170,0.5)" }} />Outflow (accumulation)</span>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
