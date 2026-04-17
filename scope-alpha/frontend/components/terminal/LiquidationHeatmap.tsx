"use client";

import { useMemo } from "react";
import { useChartToolbar } from "@/lib/chartToolbarStore";
import { useLiquidationHeatmap } from "@/hooks/useLiquidationHeatmap";

interface LiquidationHeatmapProps {
  asset: string;
}

/**
 * Absolute-positioned overlay inside the PriceChart container. Renders
 * horizontal colored bands keyed by each heatmap level's intensity. Only
 * mounted when the chart toolbar toggle is on.
 *
 * Note: because we cannot read Lightweight Charts' y-axis transform without
 * attaching via `priceScale().priceToCoordinate()`, this overlay uses the
 * heatmap's own min/max price range and renders bands at those relative
 * positions. On large chart zooms the alignment degrades. For Phase 2 this
 * is acceptable — the overlay is informational rather than precise.
 */
export function LiquidationHeatmap({ asset }: LiquidationHeatmapProps) {
  const showHeatmap = useChartToolbar((s) => s.showHeatmap);
  const { data } = useLiquidationHeatmap(asset, showHeatmap);

  const content = useMemo(() => {
    if (!data || data.levels.length === 0) return null;
    const prices = data.levels.map((l) => l.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const span = maxP - minP || 1;

    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {data.levels.map((l, i) => {
          const y = ((maxP - l.price) / span) * 100;
          const bandHeight = 100 / data.levels.length;
          const color =
            l.side === "long" ? "#ef4444" : "#22c55e"; // red/green
          return (
            <rect
              key={i}
              x={0}
              y={y - bandHeight / 2}
              width={100}
              height={bandHeight}
              fill={color}
              opacity={l.intensity * 0.35}
            />
          );
        })}
      </svg>
    );
  }, [data]);

  if (!showHeatmap) return null;

  return (
    <>
      {content}
      <div
        className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono pointer-events-none"
        style={{
          background: "rgba(10, 14, 20, 0.8)",
          color: "var(--text-muted)",
          border: "1px solid var(--glass-border)",
        }}
      >
        Liquidation heatmap — Gaussian model, estimated only
      </div>
    </>
  );
}
