"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useOnChainSupply } from "@/hooks/useOnChainSupply";
import type {
  MVRVOutput,
  MVRVRegime,
  OnChainAsset,
} from "@/types/onchain";

// ─── Chart constants ────────────────────────────────────────────────────────

const CHART_WIDTH = 800;
const CHART_HEIGHT = 240;
const MARGIN_L = 44;
const MARGIN_R = 40;
const MARGIN_T = 12;
const MARGIN_B = 24;

const REGIME_COLORS: Record<MVRVRegime, string> = {
  deep_value: "var(--data-green)",
  fair: "var(--text-muted)",
  elevated: "var(--data-yellow)",
  euphoria: "var(--data-red)",
};

const REGIME_LABELS: Record<MVRVRegime, string> = {
  deep_value: "Deep value",
  fair: "Fair",
  elevated: "Elevated",
  euphoria: "Euphoria",
};

// The z-score bands match the classifier in quant-engine/app/core/onchain.py.
// Kept as [min, max) ranges for drawing.
const REGIME_BANDS: Array<{ regime: MVRVRegime; min: number; max: number }> = [
  { regime: "deep_value", min: -4.0, max: -1.0 },
  { regime: "fair", min: -1.0, max: 0.5 },
  { regime: "elevated", min: 0.5, max: 2.5 },
  { regime: "euphoria", min: 2.5, max: 6.0 },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface SupplyDynamicsViewProps {
  asset: OnChainAsset;
}

// ─── Chart geometry ─────────────────────────────────────────────────────────

function useMVRVChartGeometry(mvrv: MVRVOutput | null) {
  return useMemo(() => {
    if (!mvrv || mvrv.series.length < 2) return null;
    const n = mvrv.series.length;
    const zValues = mvrv.series.map((p) => p.z_score);
    const zMin = Math.min(-2.0, ...zValues) * 1.05;
    const zMax = Math.max(3.0, ...zValues) * 1.05;
    const zRange = zMax - zMin || 1;

    const plotW = CHART_WIDTH - MARGIN_L - MARGIN_R;
    const plotH = CHART_HEIGHT - MARGIN_T - MARGIN_B;

    const xOf = (i: number) => MARGIN_L + (i / Math.max(n - 1, 1)) * plotW;
    const yOf = (z: number) =>
      MARGIN_T + ((zMax - z) / zRange) * plotH;

    return { n, zMin, zMax, zRange, plotW, plotH, xOf, yOf };
  }, [mvrv]);
}

// ─── View ──────────────────────────────────────────────────────────────────

export function SupplyDynamicsView({ asset }: SupplyDynamicsViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useOnChainSupply(asset);
  const geom = useMVRVChartGeometry(data?.mvrv ?? null);

  if (isLoading) {
    return (
      <GlassCard>
        <div
          className="text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Fetching on-chain supply…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data || !data.mvrv) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Supply Dynamics"
      />
    );
  }

  const mvrv = data.mvrv;
  const current = mvrv.current;
  const regimeColor = REGIME_COLORS[current.regime];

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Supply Dynamics — {asset}
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
              color: regimeColor,
              border: `1px solid ${regimeColor}`,
            }}
          >
            {REGIME_LABELS[current.regime]}
          </span>
        </div>
      </div>

      {/* Two-column grid on wide screens; stacks on narrow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* ─── MVRV card ────────────────────────────────────────────────── */}
        <GlassCard>
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              MVRV z-score ({Math.round(mvrv.lookback_days / 365)}y lookback)
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat label="MVRV" value={current.mvrv.toFixed(2)} />
            <Stat
              label="z-score"
              value={`${current.z_score >= 0 ? "+" : ""}${current.z_score.toFixed(2)}`}
              color={regimeColor}
            />
            <Stat
              label="Historical pct"
              value={`${Math.round(current.historical_percentile * 100)}%`}
            />
          </div>

          {geom && <MVRVChart mvrv={mvrv} geom={geom} />}

          <p
            className="text-xs font-body mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {current.interpretation}
          </p>
        </GlassCard>

        {/* ─── SOPR card — Slice 2 placeholder ───────────────────────────── */}
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            SOPR (Spent Output Profit Ratio)
          </div>
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Requires upgraded data tier
            </div>
            <p
              className="text-[11px] font-body text-center max-w-[40ch]"
              style={{ color: "var(--text-muted)" }}
            >
              SOPR is not on the CoinMetrics community tier, and no free public-chain
              source exposes it reliably. Adding a paid provider (Glassnode /
              CryptoQuant) would unlock it — the type shape and engine stub are
              already in place for a minimal re-enable.
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Forward return band if available */}
      {current.forward_return_distribution && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Forward 90-day MVRV change from same regime (historical)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="p25"
              value={fmtPct(current.forward_return_distribution.p25_90d)}
            />
            <Stat
              label="median"
              value={fmtPct(current.forward_return_distribution.median_90d)}
              color="var(--text-primary)"
            />
            <Stat
              label="p75"
              value={fmtPct(current.forward_return_distribution.p75_90d)}
            />
          </div>
        </GlassCard>
      )}

      {/* Disclosures */}
      <GlassCard>
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Data: CoinMetrics community tier (MVRV, market cap, supply).
          z-scores computed by the Scope Alpha Quant Engine. Regime bands are
          heuristic cutoffs — recalibration work lands with Phase 6.
        </p>
      </GlassCard>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
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
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function MVRVChart({
  mvrv,
  geom,
}: {
  mvrv: MVRVOutput;
  geom: NonNullable<ReturnType<typeof useMVRVChartGeometry>>;
}) {
  const { xOf, yOf, zMin, zMax } = geom;

  // Build the z-score line.
  const linePath = mvrv.series
    .map((p, i) => {
      const x = xOf(i);
      const y = yOf(p.z_score);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  // Regime bands clip to the visible z range.
  const bandRects = REGIME_BANDS.filter((b) => b.max > zMin && b.min < zMax)
    .map((b) => {
      const top = yOf(Math.min(b.max, zMax));
      const bottom = yOf(Math.max(b.min, zMin));
      const height = Math.max(0, bottom - top);
      return { regime: b.regime, y: top, height };
    });

  // Current marker at the last point.
  const lastIdx = mvrv.series.length - 1;
  const markerX = xOf(lastIdx);
  const markerY = yOf(mvrv.current.z_score);

  // Horizontal reference at z=0.
  const zeroY = yOf(0);

  // Axis ticks.
  const yTicks = [-1, 0, 1, 2, 3].filter((z) => z >= zMin && z <= zMax);

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full"
      style={{ height: CHART_HEIGHT }}
    >
      {/* Regime bands */}
      {bandRects.map((r) => (
        <rect
          key={r.regime}
          x={MARGIN_L}
          y={r.y}
          width={CHART_WIDTH - MARGIN_L - MARGIN_R}
          height={r.height}
          fill={REGIME_COLORS[r.regime]}
          opacity={0.08}
        />
      ))}

      {/* Zero reference line */}
      <line
        x1={MARGIN_L}
        y1={zeroY}
        x2={CHART_WIDTH - MARGIN_R}
        y2={zeroY}
        stroke="var(--glass-border)"
        strokeDasharray="3 2"
        strokeWidth={1}
      />

      {/* Y-axis ticks */}
      {yTicks.map((z) => (
        <g key={z}>
          <text
            x={MARGIN_L - 6}
            y={yOf(z) + 3}
            fontSize={9}
            fill="var(--text-muted)"
            textAnchor="end"
          >
            {z > 0 ? `+${z}` : z}
          </text>
        </g>
      ))}

      {/* z-score line */}
      <path
        d={linePath}
        stroke="var(--accent-green)"
        strokeWidth={1.5}
        fill="none"
      />

      {/* Current marker */}
      <circle
        cx={markerX}
        cy={markerY}
        r={3.5}
        fill="var(--accent-green)"
        stroke="var(--bg-primary, #0a0a0a)"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}
