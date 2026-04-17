"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useRND } from "@/hooks/useRND";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { ExpirationSelector } from "./ExpirationSelector";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { RND_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 220;
const MARGIN = 12;

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

    return { linePoints, areaPoints, spotX };
  }, [data]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Risk-Neutral Density
        </h2>
        <ExpirationSelector
          expirations={expirations}
          selected={activeExpiry}
          onChange={setExpiry}
        />
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
              </svg>
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
