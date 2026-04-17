"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useHistoricalFunding } from "@/hooks/useHistoricalFunding";
import { useAppStore } from "@/lib/store";

const WIDTH = 800;
const HEIGHT = 180;
const MARGIN = 10;

export function HistoricalFundingChart() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const { data, isLoading } = useHistoricalFunding(selectedAsset, 30);

  const content = useMemo(() => {
    if (!data) return null;

    const allPoints = [...data.series.binance, ...data.series.bybit];
    if (allPoints.length === 0) return null;

    const times = allPoints.map((p) => p.time);
    const rates = allPoints.map((p) => p.rate);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const tSpan = maxT - minT || 1;

    const rMin = Math.min(...rates, data.zScoreBands.mean - 2 * data.zScoreBands.stddev);
    const rMax = Math.max(...rates, data.zScoreBands.mean + 2 * data.zScoreBands.stddev);
    const rSpan = rMax - rMin || 1;

    const xOf = (t: number) =>
      MARGIN + ((t - minT) / tSpan) * (WIDTH - 2 * MARGIN);
    const yOf = (r: number) =>
      MARGIN + ((rMax - r) / rSpan) * (HEIGHT - 2 * MARGIN);

    const line = (series: { time: number; rate: number }[], color: string) => {
      if (series.length === 0) return null;
      const d = series
        .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.time)},${yOf(p.rate)}`)
        .join(" ");
      return <path d={d} fill="none" stroke={color} strokeWidth={1.5} />;
    };

    const zeroY = yOf(0);
    const plus1 = yOf(data.zScoreBands.mean + data.zScoreBands.stddev);
    const minus1 = yOf(data.zScoreBands.mean - data.zScoreBands.stddev);

    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        {/* ±1σ band */}
        <rect
          x={MARGIN}
          y={Math.min(plus1, minus1)}
          width={WIDTH - 2 * MARGIN}
          height={Math.abs(plus1 - minus1)}
          fill="var(--glass-border)"
          opacity={0.2}
        />
        {/* Zero line */}
        <line
          x1={MARGIN}
          x2={WIDTH - MARGIN}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--glass-border)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {line(data.series.binance, "var(--data-blue)")}
        {line(data.series.bybit, "var(--accent-green)")}
      </svg>
    );
  }, [data]);

  const hasData =
    data &&
    (data.series.binance.length > 0 || data.series.bybit.length > 0);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Funding rate — 30 day history
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-[2px]"
              style={{ background: "var(--data-blue)" }}
            />
            <span style={{ color: "var(--text-muted)" }}>Binance</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-[2px]"
              style={{ background: "var(--accent-green)" }}
            />
            <span style={{ color: "var(--text-muted)" }}>Bybit</span>
          </span>
        </div>
      </div>
      {isLoading && !data ? (
        <div
          className="h-[180px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Loading history…
        </div>
      ) : hasData ? (
        content
      ) : (
        <div
          className="h-[180px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          No historical data yet. Accumulating from live feed.
        </div>
      )}
    </GlassCard>
  );
}
