"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useOnChainFlows } from "@/hooks/useOnChainFlows";
import type { OnChainAsset } from "@/types/onchain";

const WIDTH = 800;
const HEIGHT = 60;
const MARGIN_X = 10;
const WINDOW_DAYS = 60;

interface ExchangeNetflowOverlayProps {
  asset: OnChainAsset;
}

/**
 * Compressed stacked-bar strip that sits under the price chart.
 * Inflow bars render above the centerline (red, distribution signal).
 * Outflow bars render below the centerline (green, accumulation signal).
 *
 * Silent inert-mode: if the flows API is unavailable or loading, the
 * overlay renders a thin muted card rather than nothing (the user
 * explicitly toggled it on, so some visual confirmation is warranted)
 * but without banners that crowd the chart.
 */
export function ExchangeNetflowOverlay({ asset }: ExchangeNetflowOverlayProps) {
  const { data, isLoading, unavailable } = useOnChainFlows(asset);

  const geom = useMemo(() => {
    if (!data || data.series.length < 2) return null;
    const tail = data.series.slice(-WINDOW_DAYS);
    const maxAbs = Math.max(
      1,
      ...tail.map((p) => Math.max(p.inflowUsd, p.outflowUsd)),
    );
    const plotW = WIDTH - 2 * MARGIN_X;
    const centerY = HEIGHT / 2;
    const xOf = (i: number) =>
      MARGIN_X + (i / Math.max(tail.length - 1, 1)) * plotW;
    const barW = Math.max(1.5, plotW / tail.length - 1);
    return { tail, maxAbs, centerY, xOf, barW, plotH: HEIGHT };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <div
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Netflow — loading…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data || !geom) {
    return (
      <GlassCard>
        <div
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Netflow unavailable for {asset} — data provider inert.
        </div>
      </GlassCard>
    );
  }

  const { tail, maxAbs, centerY, xOf, barW, plotH } = geom;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Exchange netflow — last {tail.length}d
        </span>
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span style={{ color: "var(--data-red)" }}>inflow</span>
          {" / "}
          <span style={{ color: "var(--data-green)" }}>outflow</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: HEIGHT }}
      >
        <line
          x1={MARGIN_X}
          y1={centerY}
          x2={WIDTH - MARGIN_X}
          y2={centerY}
          stroke="var(--glass-border)"
          strokeWidth={0.5}
        />
        {tail.map((p, i) => {
          const x = xOf(i) - barW / 2;
          const inH = (p.inflowUsd / maxAbs) * (plotH / 2);
          const outH = (p.outflowUsd / maxAbs) * (plotH / 2);
          return (
            <g key={p.timestamp}>
              <rect
                x={x}
                y={centerY - inH}
                width={barW}
                height={inH}
                fill="var(--data-red)"
                opacity={0.9}
              />
              <rect
                x={x}
                y={centerY}
                width={barW}
                height={outH}
                fill="var(--data-green)"
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>
    </GlassCard>
  );
}
