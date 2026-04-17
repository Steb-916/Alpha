"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useHistoricalOI } from "@/hooks/useHistoricalOI";
import { useAppStore } from "@/lib/store";
import { formatLargeNumber } from "@/lib/utils";

const WIDTH = 800;
const HEIGHT = 180;
const MARGIN = 10;

export function HistoricalOIChart() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const { data, isLoading } = useHistoricalOI(selectedAsset, 7);

  const content = useMemo(() => {
    if (!data) return null;

    const allPoints = [...data.series.binance, ...data.series.bybit];
    if (allPoints.length === 0) return null;

    const times = allPoints.map((p) => p.time);
    const ois = allPoints.map((p) => p.oiUsd || p.oi);
    const prices = allPoints.map((p) => p.price).filter((p) => p > 0);

    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const tSpan = maxT - minT || 1;

    const oMin = Math.min(...ois);
    const oMax = Math.max(...ois);
    const oSpan = oMax - oMin || 1;

    const pMin = prices.length ? Math.min(...prices) : 0;
    const pMax = prices.length ? Math.max(...prices) : 1;
    const pSpan = pMax - pMin || 1;

    const xOf = (t: number) =>
      MARGIN + ((t - minT) / tSpan) * (WIDTH - 2 * MARGIN);
    const yOIOf = (o: number) =>
      MARGIN + ((oMax - o) / oSpan) * (HEIGHT - 2 * MARGIN);
    const yPriceOf = (p: number) =>
      MARGIN + ((pMax - p) / pSpan) * (HEIGHT - 2 * MARGIN);

    const oiLine = (
      series: { time: number; oi: number; oiUsd: number }[],
      color: string,
    ) => {
      if (series.length === 0) return null;
      const d = series
        .map((p, i) => {
          const v = p.oiUsd || p.oi;
          return `${i === 0 ? "M" : "L"}${xOf(p.time)},${yOIOf(v)}`;
        })
        .join(" ");
      return <path d={d} fill="none" stroke={color} strokeWidth={1.5} />;
    };

    // Build a combined price series using both exchanges' price field.
    const priceSeries = [...data.series.binance, ...data.series.bybit]
      .filter((p) => p.price > 0)
      .sort((a, b) => a.time - b.time);
    const priceLineD = priceSeries
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.time)},${yPriceOf(p.price)}`,
      )
      .join(" ");

    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        {priceSeries.length > 0 && (
          <path
            d={priceLineD}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
        )}
        {oiLine(data.series.binance, "var(--data-blue)")}
        {oiLine(data.series.bybit, "var(--accent-green)")}
      </svg>
    );
  }, [data]);

  const hasData =
    data && (data.series.binance.length > 0 || data.series.bybit.length > 0);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Open interest — 7 day history
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
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-[2px]"
              style={{
                background: "var(--text-muted)",
                borderTop: "1px dashed var(--text-muted)",
              }}
            />
            <span style={{ color: "var(--text-muted)" }}>Price</span>
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
          No historical data yet. Accumulating hourly from live feed.
        </div>
      )}
      {hasData && data && (
        <div
          className="mt-2 flex gap-4 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>
            Latest Binance:{" "}
            {formatLargeNumber(
              data.series.binance[data.series.binance.length - 1]?.oiUsd ?? 0,
            )}
          </span>
          <span>
            Latest Bybit:{" "}
            {formatLargeNumber(
              data.series.bybit[data.series.bybit.length - 1]?.oiUsd ?? 0,
            )}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
