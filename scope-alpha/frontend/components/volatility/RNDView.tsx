"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRND } from "@/hooks/useRND";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { useOnChainSupply } from "@/hooks/useOnChainSupply";
import { ExpirationSelector } from "./ExpirationSelector";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { RND_STAGES } from "@/lib/options/loading-stages";
import type { MVRVRegime, OnChainAsset } from "@/types/onchain";

const WIDTH = 800;
const HEIGHT = 220;
const MARGIN = 12;

// Phase 5 Slice 3 — fixed MVRV thresholds for the cost-basis regime bands.
// Realized_price is derived from current MVRV (= spot / mvrv), so the price
// ranges that correspond to each regime are:
//   deep_value  (MVRV < 1.0)       →  price <  realized_price
//   fair        (1.0 ≤ MVRV < 1.5) →  [realized_price, realized_price × 1.5)
//   elevated    (1.5 ≤ MVRV < 3.0) →  [× 1.5, × 3.0)
//   euphoria    (MVRV ≥ 3.0)       →  ≥ × 3.0
// Bands are clipped to the visible RND x-axis range — anything outside is
// dropped, not rendered off-canvas.
const MVRV_BAND_RATIOS: Array<{ regime: MVRVRegime; lo: number; hi: number }> = [
  { regime: "deep_value", lo: 0, hi: 1.0 },
  { regime: "fair", lo: 1.0, hi: 1.5 },
  { regime: "elevated", lo: 1.5, hi: 3.0 },
  { regime: "euphoria", lo: 3.0, hi: Number.POSITIVE_INFINITY },
];

// Re-declared here rather than imported so RNDView doesn't reach into the
// onchain component directory. Mirror the map in SupplyDynamicsView.tsx.
const BAND_COLORS: Record<MVRVRegime, string> = {
  deep_value: "var(--data-green)",
  fair: "var(--text-muted)",
  elevated: "var(--data-yellow)",
  euphoria: "var(--data-red)",
};

interface RNDViewProps {
  asset: string;
}

export function RNDView({ asset }: RNDViewProps) {
  const { data: chain } = useOptionsChain(asset);
  const expirations = chain?.expirations ?? [];
  const [expiry, setExpiry] = useState<string | null>(null);
  const activeExpiry = expiry ?? expirations[0]?.expiration ?? null;
  const expiryDate = activeExpiry ? activeExpiry.slice(0, 10) : null;

  const { data, isLoading, unavailable, quantEngineConfigured } = useRND(
    asset,
    expiryDate,
  );
  const showLoader = useDelayedLoadingSignal(isLoading);

  // Phase 5 Slice 3 — cost-basis overlay state + on-chain data. MVRV is
  // only computed for BTC/ETH; for other assets the hook returns unavailable
  // and the toggle stays hidden.
  const [showCostBasis, setShowCostBasis] = useState(false);
  const { data: onchainSupply } = useOnChainSupply(asset as OnChainAsset);
  const currentMvrv = onchainSupply?.mvrv?.current.mvrv ?? null;
  const realizedPrice =
    currentMvrv != null && currentMvrv > 0 && data != null
      ? data.spot_price / currentMvrv
      : null;
  const costBasisAvailable = realizedPrice != null && realizedPrice > 0;

  const chart = useMemo(() => {
    if (!data) return null;
    const prices = data.density.map((p) => p.price);
    const probs = data.density.map((p) => p.probability);
    if (prices.length === 0) return null;
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const maxProb = Math.max(...probs);
    if (maxProb === 0 || minP === maxP) return null;

    const xOf = (p: number) =>
      MARGIN + ((p - minP) / (maxP - minP)) * (WIDTH - 2 * MARGIN);
    const yOf = (v: number) =>
      HEIGHT - MARGIN - (v / maxProb) * (HEIGHT - 2 * MARGIN);

    const linePoints = data.density
      .map((pt, i) => `${i === 0 ? "M" : "L"}${xOf(pt.price)},${yOf(pt.probability)}`)
      .join(" ");
    const areaPoints = `${linePoints} L${xOf(maxP)},${HEIGHT - MARGIN} L${xOf(minP)},${HEIGHT - MARGIN} Z`;
    const spotX = xOf(data.spot_price);

    // Slice 3 cost-basis geometry. Realized-price line is dropped when the
    // price falls outside the visible x-range. Bands are clipped to the
    // visible range and skipped entirely when they don't intersect.
    let realizedX: number | null = null;
    let bands: Array<{ regime: MVRVRegime; xStart: number; xEnd: number }> = [];
    if (realizedPrice != null && realizedPrice > 0) {
      if (realizedPrice >= minP && realizedPrice <= maxP) {
        realizedX = xOf(realizedPrice);
      }
      bands = MVRV_BAND_RATIOS.flatMap((b) => {
        const bandLo = b.lo * realizedPrice;
        const bandHi = Number.isFinite(b.hi)
          ? b.hi * realizedPrice
          : Number.POSITIVE_INFINITY;
        const visibleLo = Math.max(bandLo, minP);
        const visibleHi = Math.min(bandHi, maxP);
        if (visibleLo >= visibleHi) return []; // no intersection → skip
        return [
          {
            regime: b.regime,
            xStart: xOf(visibleLo),
            xEnd: xOf(visibleHi),
          },
        ];
      });
    }

    return { linePoints, areaPoints, spotX, realizedX, bands };
  }, [data, realizedPrice]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Risk-Neutral Density
        </h2>
        <div className="flex items-center gap-2">
          {costBasisAvailable && (
            <button
              onClick={() => setShowCostBasis((v) => !v)}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono cursor-pointer"
              style={{
                background: showCostBasis
                  ? "rgba(0, 212, 170, 0.1)"
                  : "var(--glass-bg)",
                border: `1px solid ${showCostBasis ? "var(--accent-green)" : "var(--glass-border)"}`,
                color: showCostBasis
                  ? "var(--accent-green)"
                  : "var(--text-secondary)",
                transition: "all 0.2s ease",
              }}
              title="Overlay realized price (spot / MVRV) + MVRV regime bands on the RND"
            >
              Cost-basis overlay
            </button>
          )}
          <ExpirationSelector
            expirations={expirations}
            selected={activeExpiry}
            onChange={setExpiry}
          />
        </div>
      </div>

      {isLoading ? (
        showLoader ? (
          <ComputeLoader stages={RND_STAGES} title="Running RND pipeline" />
        ) : (
          <div className="h-full" />
        )
      ) : unavailable || !data ? (
        <UnavailableBanner
          quantEngineConfigured={quantEngineConfigured}
          tool="RND"
        />
      ) : (
        <>
          <GlassCard>
            {chart && (
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full"
                style={{ height: HEIGHT }}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="rnd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Cost-basis overlay bands render FIRST so the RND area/line
                    draws on top. Rendered only when the toggle is on AND
                    bands intersect the visible range. */}
                {showCostBasis &&
                  chart.bands.map((b) => (
                    <rect
                      key={b.regime}
                      x={b.xStart}
                      y={MARGIN}
                      width={Math.max(0, b.xEnd - b.xStart)}
                      height={HEIGHT - 2 * MARGIN}
                      fill={BAND_COLORS[b.regime]}
                      opacity={0.08}
                    />
                  ))}
                <path d={chart.areaPoints} fill="url(#rnd-fill)" />
                <path d={chart.linePoints} fill="none" stroke="var(--accent-green)" strokeWidth={1.5} />
                <line
                  x1={chart.spotX}
                  x2={chart.spotX}
                  y1={MARGIN}
                  y2={HEIGHT - MARGIN}
                  stroke="var(--text-primary)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                {/* Realized-price line — single vertical line at spot/MVRV.
                    Deliberately different dash pattern + color from spot so
                    the two lines read as distinct signals, not one miscoloured
                    line. Dropped when realized_price is outside the RND
                    x-axis range (chart.realizedX === null). */}
                {showCostBasis && chart.realizedX != null && (
                  <line
                    x1={chart.realizedX}
                    x2={chart.realizedX}
                    y1={MARGIN}
                    y2={HEIGHT - MARGIN}
                    stroke="var(--data-orange, #f59e0b)"
                    strokeWidth={1.5}
                    strokeDasharray="2 3"
                  />
                )}
              </svg>
            )}
            {showCostBasis && costBasisAvailable && realizedPrice != null && (
              <div
                className="mt-2 flex items-center gap-3 flex-wrap text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                <span>
                  <span
                    className="inline-block w-3 h-[1.5px] align-middle mr-1"
                    style={{ background: "var(--text-primary)" }}
                  />
                  spot ${Math.round(data.spot_price).toLocaleString()}
                </span>
                <span>
                  <span
                    className="inline-block w-3 h-[1.5px] align-middle mr-1"
                    style={{ background: "var(--data-orange, #f59e0b)" }}
                  />
                  realized ${Math.round(realizedPrice).toLocaleString()}
                  {" (spot / MVRV)"}
                </span>
                <span>
                  MVRV{" "}
                  {currentMvrv != null ? currentMvrv.toFixed(2) : "—"} ·
                  regime{" "}
                  <span
                    style={{
                      color:
                        BAND_COLORS[
                          onchainSupply?.mvrv?.current.regime ?? "fair"
                        ],
                    }}
                  >
                    {onchainSupply?.mvrv?.current.regime ?? "—"}
                  </span>
                </span>
                <span style={{ fontStyle: "italic" }}>
                  Derived single value — not a weighted cost-basis
                  distribution (paid-tier only).
                </span>
              </div>
            )}
          </GlassCard>

          <div className="grid grid-cols-4 gap-2">
            <StatCard label="Mean" value={`$${Math.round(data.statistics.mean).toLocaleString()}`} />
            <StatCard label="Median" value={`$${Math.round(data.statistics.median).toLocaleString()}`} />
            <StatCard label="Std Dev" value={`$${Math.round(data.statistics.std_dev).toLocaleString()}`} />
            <StatCard label="Skewness" value={data.statistics.skewness.toFixed(2)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Prob > spot"
              value={`${(data.statistics.prob_above_spot * 100).toFixed(0)}%`}
              color="var(--accent-green)"
            />
            <StatCard
              label="Prob > $90K"
              value={`${(data.statistics.prob_above_90k * 100).toFixed(0)}%`}
              color="var(--data-green)"
            />
            <StatCard
              label="Prob < $80K"
              value={`${(data.statistics.prob_below_80k * 100).toFixed(0)}%`}
              color="var(--data-red)"
            />
          </div>
          <GlassCard>
            <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
              The options market implies a{" "}
              <strong style={{ color: "var(--accent-green)" }}>
                {(data.statistics.prob_above_spot * 100).toFixed(0)}% chance
              </strong>{" "}
              {asset} will be above the current price ($
              {Math.round(data.spot_price).toLocaleString()}) by{" "}
              {data.expiry_date.slice(0, 10)}. Extracted via{" "}
              {data.confidence.method} from {data.confidence.n_options_used}{" "}
              options in the strike range $
              {data.confidence.strike_range[0].toLocaleString()}–$
              {data.confidence.strike_range[1].toLocaleString()}.
            </p>
          </GlassCard>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "var(--text-primary)",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <GlassCard>
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div className="text-lg font-bold font-mono" style={{ color }}>
        {value}
      </div>
    </GlassCard>
  );
}
