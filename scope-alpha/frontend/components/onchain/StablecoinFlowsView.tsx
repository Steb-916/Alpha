"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useStablecoins } from "@/hooks/useStablecoins";
import type { StablecoinChartPoint } from "@/types/onchain";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const MARGIN_L = 60;
const MARGIN_R = 20;
const MARGIN_T = 12;
const MARGIN_B = 24;

const WINDOW_2Y_DAYS = 730;

function formatUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

function deltaCopy(current: number, prev: number | null): string {
  if (prev == null || prev === 0) return "—";
  const pct = ((current - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function sampleChart(
  chart: StablecoinChartPoint[],
  showFullHistory: boolean,
): StablecoinChartPoint[] {
  if (chart.length === 0) return chart;

  if (!showFullHistory) {
    // Last ~2 years of daily points.
    return chart.slice(-WINDOW_2Y_DAYS);
  }
  // For full history, downsample past the 2-year mark to weekly to keep
  // render density reasonable on wide screens.
  const tail = chart.slice(-WINDOW_2Y_DAYS);
  const olderDaily = chart.slice(0, -WINDOW_2Y_DAYS);
  const olderWeekly: StablecoinChartPoint[] = [];
  for (let i = 0; i < olderDaily.length; i += 7) {
    olderWeekly.push(olderDaily[i]);
  }
  return [...olderWeekly, ...tail];
}

function useChartGeometry(points: StablecoinChartPoint[]) {
  return useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.totalSupplyUsd);
    const minV = Math.min(...values) * 0.95;
    const maxV = Math.max(...values) * 1.05;
    const range = maxV - minV || 1;

    const plotW = CHART_WIDTH - MARGIN_L - MARGIN_R;
    const plotH = CHART_HEIGHT - MARGIN_T - MARGIN_B;

    const xOf = (i: number) =>
      MARGIN_L + (i / Math.max(points.length - 1, 1)) * plotW;
    const yOf = (v: number) => MARGIN_T + ((maxV - v) / range) * plotH;

    return { minV, maxV, range, plotW, plotH, xOf, yOf };
  }, [points]);
}

export function StablecoinFlowsView() {
  const { data, isLoading, unavailable } = useStablecoins();
  const [showFullHistory, setShowFullHistory] = useState(false);

  const chartPoints = useMemo(
    () => (data ? sampleChart(data.chart, showFullHistory) : []),
    [data, showFullHistory],
  );
  const geom = useChartGeometry(chartPoints);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Fetching stablecoin data…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured
        tool="Stablecoin Flows"
      />
    );
  }

  const { aggregate } = data;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Stablecoins — aggregate
        </h2>
        {data.staleness === "stale" && (
          <span
            className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "var(--glass-bg)",
              color: "var(--text-muted)",
              border: "1px solid var(--glass-border)",
            }}
          >
            Stale
          </span>
        )}
      </div>

      <GlassCard>
        <div
          className="text-[10px] font-mono uppercase tracking-wider mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          Total circulating (USDT + USDC + DAI)
        </div>
        <div
          className="text-2xl font-bold font-mono"
          style={{ color: "var(--text-primary)" }}
        >
          {formatUsd(aggregate.totalSupplyUsd)}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              7d change
            </div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {deltaCopy(aggregate.totalSupplyUsd, aggregate.supply7dAgoUsd)}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              30d change
            </div>
            <div
              className="text-sm font-bold font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {deltaCopy(aggregate.totalSupplyUsd, aggregate.supply30dAgoUsd)}
            </div>
          </div>
        </div>
      </GlassCard>

      {geom && (
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Aggregate supply (USD)
            </div>
            <button
              onClick={() => setShowFullHistory((v) => !v)}
              className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono uppercase tracking-wider"
              style={{
                background: "var(--glass-bg)",
                color: "var(--text-secondary)",
                border: "1px solid var(--glass-border)",
                cursor: "pointer",
              }}
            >
              {showFullHistory ? "Last 2y" : "Full history"}
            </button>
          </div>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full"
            style={{ height: CHART_HEIGHT }}
          >
            <path
              d={chartPoints
                .map((p, i) => {
                  const x = geom.xOf(i);
                  const y = geom.yOf(p.totalSupplyUsd);
                  return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                })
                .join(" ")}
              stroke="var(--accent-green)"
              strokeWidth={1.5}
              fill="none"
            />
            <text
              x={MARGIN_L - 6}
              y={MARGIN_T + 10}
              fontSize={9}
              fill="var(--text-muted)"
              textAnchor="end"
            >
              {formatUsd(geom.maxV)}
            </text>
            <text
              x={MARGIN_L - 6}
              y={CHART_HEIGHT - MARGIN_B + 3}
              fontSize={9}
              fill="var(--text-muted)"
              textAnchor="end"
            >
              {formatUsd(geom.minV)}
            </text>
          </svg>
        </GlassCard>
      )}

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Per-issuer breakdown
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <th className="text-left py-1 pr-3">Issuer</th>
              <th className="text-right pr-3">Circulating</th>
              <th className="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            <IssuerRow
              name="USDT"
              value={aggregate.usdtSupplyUsd}
              total={aggregate.totalSupplyUsd}
            />
            <IssuerRow
              name="USDC"
              value={aggregate.usdcSupplyUsd}
              total={aggregate.totalSupplyUsd}
            />
            <IssuerRow
              name="DAI"
              value={aggregate.daiSupplyUsd}
              total={aggregate.totalSupplyUsd}
            />
          </tbody>
        </table>
      </GlassCard>

      <GlassCard>
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Source: DefiLlama stablecoins API (free). Exchange-balance % of
          supply requires an upgraded provider — shown as N/A in v1.
        </p>
      </GlassCard>
    </div>
  );
}

function IssuerRow({
  name,
  value,
  total,
}: {
  name: string;
  value: number;
  total: number;
}) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
      <td className="py-1 pr-3" style={{ color: "var(--text-primary)" }}>
        {name}
      </td>
      <td
        className="text-right pr-3"
        style={{ color: "var(--text-secondary)" }}
      >
        {formatUsd(value)}
      </td>
      <td className="text-right" style={{ color: "var(--text-secondary)" }}>
        {share.toFixed(1)}%
      </td>
    </tr>
  );
}
