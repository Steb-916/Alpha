"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useHistoricalLiquidations } from "@/hooks/useHistoricalLiquidations";
import { useAppStore } from "@/lib/store";
import { formatLargeNumber } from "@/lib/utils";

const WIDTH = 800;
const HEIGHT = 200;
const MARGIN_X = 14;
const MARGIN_Y = 10;

export function HistoricalLiquidationsChart() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const { data, isLoading } = useHistoricalLiquidations(selectedAsset, 30);

  const content = useMemo(() => {
    if (!data || data.buckets.length === 0) return null;
    const maxVal = Math.max(
      ...data.buckets.map((b) => b.longUsd + b.shortUsd),
      1,
    );

    const usableWidth = WIDTH - 2 * MARGIN_X;
    const usableHeight = HEIGHT - 2 * MARGIN_Y;
    const barWidth = (usableWidth / data.buckets.length) * 0.8;
    const gap = (usableWidth / data.buckets.length) * 0.2;
    const colWidth = barWidth + gap;

    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        {data.buckets.map((b, i) => {
          const total = b.longUsd + b.shortUsd;
          const longH = (b.longUsd / maxVal) * usableHeight;
          const shortH = (b.shortUsd / maxVal) * usableHeight;
          const x = MARGIN_X + i * colWidth + gap / 2;
          const baseY = HEIGHT - MARGIN_Y;
          return (
            <g key={b.date}>
              <title>
                {b.date} — long ${formatLargeNumber(b.longUsd)} / short $
                {formatLargeNumber(b.shortUsd)}
              </title>
              {b.shortUsd > 0 && (
                <rect
                  x={x}
                  y={baseY - shortH}
                  width={barWidth}
                  height={shortH}
                  fill="var(--data-green)"
                  opacity={0.85}
                />
              )}
              {b.longUsd > 0 && (
                <rect
                  x={x}
                  y={baseY - shortH - longH}
                  width={barWidth}
                  height={longH}
                  fill="var(--data-red)"
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  }, [data]);

  const hasData = data && data.buckets.some((b) => b.total > 0);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Liquidations — 30 day daily totals
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: "var(--data-red)" }}
            />
            <span style={{ color: "var(--text-muted)" }}>Long liqs</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: "var(--data-green)" }}
            />
            <span style={{ color: "var(--text-muted)" }}>Short liqs</span>
          </span>
        </div>
      </div>
      {isLoading && !data ? (
        <div
          className="h-[200px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Loading history…
        </div>
      ) : hasData ? (
        content
      ) : (
        <div
          className="h-[200px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          No liquidation history yet. Accumulating from WS stream.
        </div>
      )}
    </GlassCard>
  );
}
