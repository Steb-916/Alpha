"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useVRP } from "@/hooks/useVRP";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { VRP_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 220;
const MARGIN_X = 30;
const MARGIN_Y = 14;

interface VRPViewProps {
  asset: string;
}

export function VRPView({ asset }: VRPViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useVRP(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const chart = useMemo(() => {
    if (!data || data.vrp_series.length === 0) return null;
    const series = data.vrp_series;
    const values = series.flatMap((p) => [p.iv, p.rv]);
    const minY = Math.min(...values, 0);
    const maxY = Math.max(...values, 0);
    const range = maxY - minY || 1;
    const step = (WIDTH - 2 * MARGIN_X) / Math.max(1, series.length - 1);
    const xOf = (i: number) => MARGIN_X + i * step;
    const yOf = (v: number) =>
      HEIGHT - MARGIN_Y - ((v - minY) / range) * (HEIGHT - 2 * MARGIN_Y);
    const ivPath = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.iv)}`)
      .join(" ");
    const rvPath = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.rv)}`)
      .join(" ");
    return { series, xOf, yOf, ivPath, rvPath };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={VRP_STAGES} title="Computing VRP" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data || !chart) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="VRP"
      />
    );
  }

  const vrpColor =
    data.current_vrp > 0 ? "var(--accent-green)" : "var(--data-red)";

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Volatility Risk Premium — {asset}
        </h2>
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Mean {data.mean_vrp.toFixed(2)} · σ {data.std_vrp.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Current VRP
          </div>
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: vrpColor }}
          >
            {data.current_vrp >= 0 ? "+" : ""}
            {data.current_vrp.toFixed(2)}%
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Percentile (historical)
          </div>
          <div
            className="text-2xl font-bold font-mono"
            style={{ color: "var(--data-yellow)" }}
          >
            {data.current_vrp_percentile.toFixed(0)}th
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          IV vs Realized Vol (30d)
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          <path d={chart.ivPath} fill="none" stroke="var(--accent-green)" strokeWidth={1.5} />
          <path
            d={chart.rvPath}
            fill="none"
            stroke="var(--data-red)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        </svg>
        <div
          className="flex gap-4 mt-1 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>
            <span
              className="inline-block w-4 h-[2px] mr-1 align-middle"
              style={{ background: "var(--accent-green)" }}
            />
            Implied Vol
          </span>
          <span>
            <span
              className="inline-block w-4 h-[2px] mr-1 align-middle"
              style={{ background: "var(--data-red)" }}
            />
            Realized Vol (30d)
          </span>
        </div>
      </GlassCard>

      <GlassCard>
        <p
          className="text-sm font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          {data.assessment}
        </p>
      </GlassCard>
    </div>
  );
}
