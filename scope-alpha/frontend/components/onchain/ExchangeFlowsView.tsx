"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useOnChainFlows } from "@/hooks/useOnChainFlows";
import type {
  FlowObservation,
  FlowRegime,
  OnChainAsset,
  OnChainFlowsResponse,
} from "@/types/onchain";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const MARGIN_L = 52;
const MARGIN_R = 20;
const MARGIN_T = 12;
const MARGIN_B = 28;
const WINDOW_DAYS = 90;

const REGIME_COLORS: Record<FlowRegime, string> = {
  accumulation: "var(--data-green)",
  distribution: "var(--data-red)",
  neutral: "var(--text-muted)",
};

const REGIME_LABELS: Record<FlowRegime, string> = {
  accumulation: "Accumulation",
  distribution: "Distribution",
  neutral: "Neutral",
};

interface ExchangeFlowsViewProps {
  asset: OnChainAsset;
}

function formatUsd(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function useChartGeometry(series: FlowObservation[]) {
  return useMemo(() => {
    if (!series || series.length < 2) return null;
    const tail = series.slice(-WINDOW_DAYS);
    const maxAbs = Math.max(
      1,
      ...tail.map((p) => Math.max(p.inflowUsd, p.outflowUsd)),
    );

    const plotW = CHART_WIDTH - MARGIN_L - MARGIN_R;
    const plotH = CHART_HEIGHT - MARGIN_T - MARGIN_B;
    const centerY = MARGIN_T + plotH / 2;

    const xOf = (i: number) =>
      MARGIN_L + (i / Math.max(tail.length - 1, 1)) * plotW;
    const barW = Math.max(2, plotW / tail.length - 1);

    return {
      tail,
      maxAbs,
      plotW,
      plotH,
      centerY,
      xOf,
      barW,
    };
  }, [series]);
}

export function ExchangeFlowsView({ asset }: ExchangeFlowsViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useOnChainFlows(asset);
  const geom = useChartGeometry(data?.series ?? []);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Fetching exchange flows…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Exchange Flows"
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <Header data={data} asset={asset} />
      {geom && <FlowChart geom={geom} />}
      <AggregateNote />
      <Interpretation data={data} />
    </div>
  );
}

function Header({
  data,
  asset,
}: {
  data: OnChainFlowsResponse;
  asset: OnChainAsset;
}) {
  const regime = data.regime?.regime ?? "neutral";
  const color = REGIME_COLORS[regime];
  return (
    <div className="flex items-center justify-between gap-3 shrink-0">
      <h2
        className="text-sm font-bold font-display"
        style={{ color: "var(--text-primary)" }}
      >
        Exchange Flows — {asset}
      </h2>
      <div className="flex items-center gap-2">
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
        <span
          className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            color,
            border: `1px solid ${color}`,
          }}
        >
          {REGIME_LABELS[regime]}
        </span>
      </div>
    </div>
  );
}

function FlowChart({
  geom,
}: {
  geom: NonNullable<ReturnType<typeof useChartGeometry>>;
}) {
  const { tail, maxAbs, centerY, plotH, xOf, barW } = geom;
  return (
    <GlassCard>
      <div
        className="text-xs font-mono uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Daily flows — last {tail.length} days
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        style={{ height: CHART_HEIGHT }}
      >
        {/* centerline */}
        <line
          x1={MARGIN_L}
          y1={centerY}
          x2={CHART_WIDTH - MARGIN_R}
          y2={centerY}
          stroke="var(--glass-border)"
          strokeWidth={1}
        />
        {/* Bars: outflow above center (green), inflow below (red). Sign
            convention matches the "coins leaving exchange → bullish" framing. */}
        {tail.map((p, i) => {
          const x = xOf(i) - barW / 2;
          const outH = (p.outflowUsd / maxAbs) * (plotH / 2);
          const inH = (p.inflowUsd / maxAbs) * (plotH / 2);
          return (
            <g key={p.timestamp}>
              <rect
                x={x}
                y={centerY - outH}
                width={barW}
                height={outH}
                fill="var(--data-green)"
                opacity={0.85}
              />
              <rect
                x={x}
                y={centerY}
                width={barW}
                height={inH}
                fill="var(--data-red)"
                opacity={0.85}
              />
            </g>
          );
        })}
        <text
          x={6}
          y={MARGIN_T + 10}
          fontSize={9}
          fill="var(--data-green)"
        >
          outflow
        </text>
        <text
          x={6}
          y={CHART_HEIGHT - MARGIN_B / 2}
          fontSize={9}
          fill="var(--data-red)"
        >
          inflow
        </text>
      </svg>
    </GlassCard>
  );
}

function AggregateNote() {
  return (
    <GlassCard>
      <p
        className="text-[11px] font-body"
        style={{ color: "var(--text-muted)" }}
      >
        Aggregate flows — per-exchange breakdown requires an upgraded provider
        (Glassnode / Arkham). CoinMetrics community tier reports a single
        combined series.
      </p>
    </GlassCard>
  );
}

function Interpretation({ data }: { data: OnChainFlowsResponse }) {
  if (!data.regime) {
    return (
      <GlassCard>
        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
          Flow regime is computed by the Quant Engine. Set{" "}
          <code>QUANT_ENGINE_URL</code> to enable regime classification.
        </p>
      </GlassCard>
    );
  }
  const r = data.regime;
  return (
    <GlassCard>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="7d net" value={formatUsd(r.net_flow_7d_usd)} />
        <Stat label="30d net" value={formatUsd(r.net_flow_30d_usd)} />
        <Stat
          label="Confidence"
          value={`${Math.round(r.regime_confidence * 100)}%`}
        />
      </div>
      <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
        {r.interpretation}
      </p>
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-sm font-bold font-mono"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
