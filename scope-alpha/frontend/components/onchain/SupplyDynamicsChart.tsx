"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useSupplyMetrics } from "@/hooks/useOnChain";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtBig(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  return `$${(v / 1e6).toFixed(1)}M`;
}

interface Props { asset: string }

export function SupplyDynamicsChart({ asset }: Props) {
  const { data, isLoading, error } = useSupplyMetrics(asset);

  const chart = useMemo(() => {
    if (!data || data.history.length < 2) return null;
    const pts = data.history.filter((p) => p.marketCap !== null && p.realizedCap !== null);
    if (pts.length < 2) return null;
    const maxMc = Math.max(...pts.map((p) => p.marketCap!));
    const minMc = Math.min(...pts.map((p) => p.marketCap!));
    const range = maxMc - minMc || 1;
    return { pts, maxMc, minMc, range };
  }, [data]);

  if (isLoading) {
    return <GlassCard><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p></GlassCard>;
  }

  if (error || !data) {
    return (
      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Supply data not yet available. Trigger <code style={{ color: "var(--accent-green)" }}>/api/cron/refresh-onchain</code>.
        </p>
      </GlassCard>
    );
  }

  const W = 580;
  const H = 140;
  const PAD_X = 40;
  const PAD_Y = 10;

  const mkPath = (pts: Array<{ marketCap: number | null; realizedCap: number | null }>, key: "marketCap" | "realizedCap", max: number, min: number): string => {
    const range = max - min || 1;
    return pts
      .map((p, i) => {
        const x = PAD_X + (i / (pts.length - 1)) * (W - PAD_X * 2);
        const v = p[key] ?? min;
        const y = PAD_Y + ((max - v) / range) * (H - PAD_Y * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Supply Dynamics — {asset}
        </h2>
      </div>

      {/* Current values */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Market Cap</div>
          <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {fmtBig(data.current.marketCap)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Realized Cap</div>
          <div className="text-xl font-bold font-mono" style={{ color: "var(--text-secondary)" }}>
            {fmtBig(data.current.realizedCap)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>MVRV Ratio</div>
          <div
            className="text-xl font-bold font-mono"
            style={{
              color: data.current.mvrvRatio
                ? data.current.mvrvRatio > 3 ? "var(--data-red)" : data.current.mvrvRatio < 1 ? "var(--accent-green)" : "var(--data-yellow)"
                : "var(--text-muted)",
            }}
          >
            {data.current.mvrvRatio ? `${data.current.mvrvRatio.toFixed(2)}x` : "—"}
          </div>
        </GlassCard>
      </div>

      {/* Market cap vs realized cap chart */}
      {chart && (
        <GlassCard>
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Market Cap vs Realized Cap — 90 Day
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* Realized cap — green */}
            <path
              d={mkPath(chart.pts, "realizedCap", chart.maxMc, chart.minMc)}
              fill="none"
              stroke="rgba(0,212,170,0.6)"
              strokeWidth={1.5}
            />
            {/* Market cap — blue */}
            <path
              d={mkPath(chart.pts, "marketCap", chart.maxMc, chart.minMc)}
              fill="none"
              stroke="rgba(59,130,246,0.8)"
              strokeWidth={1.5}
            />
          </svg>
          <div className="flex gap-4 mt-1 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span><span className="inline-block w-4 h-[2px] mr-1 align-middle" style={{ background: "rgba(59,130,246,0.8)" }} />Market Cap</span>
            <span><span className="inline-block w-4 h-[2px] mr-1 align-middle" style={{ background: "rgba(0,212,170,0.6)" }} />Realized Cap</span>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          Realized Cap represents the value of all coins at the price they were last moved on-chain — a measure of aggregate cost basis. When market cap diverges far above realized cap, the market may be overextended.
        </p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
