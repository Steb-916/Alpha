"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useDEX } from "@/hooks/useDEX";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { DEX_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 260;
const MARGIN_X = 40;
const MARGIN_Y = 20;

interface DEXViewProps {
  asset: string;
}

function formatUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

const LONG_COLOR = "#3b82f6"; // blue
const SHORT_COLOR = "#f97316"; // orange

export function DEXView({ asset }: DEXViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useDEX(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const chart = useMemo(() => {
    if (!data || data.levels.length === 0) return null;
    const strikes = data.levels.map((l) => l.strike);
    const values = data.levels.map((l) => l.dex_usd);
    const minK = Math.min(...strikes);
    const maxK = Math.max(...strikes);
    const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);

    const xOf = (k: number) =>
      MARGIN_X + ((k - minK) / (maxK - minK || 1)) * (WIDTH - 2 * MARGIN_X);
    const centerY = HEIGHT / 2;
    const barHeight = (v: number) =>
      (Math.abs(v) / maxAbs) * (HEIGHT / 2 - MARGIN_Y);
    const barWidth = Math.max(
      2,
      ((WIDTH - 2 * MARGIN_X) / Math.max(strikes.length, 1)) * 0.7,
    );

    return { minK, maxK, xOf, centerY, barHeight, barWidth };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={DEX_STAGES} title="Computing delta exposure" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data || !chart) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Delta Exposure"
      />
    );
  }

  const spotX = chart.xOf(data.spot_price);
  const biasLabel = data.directional_bias.replace("_", " ");
  const biasColor =
    data.directional_bias === "long" || data.directional_bias === "slightly_long"
      ? LONG_COLOR
      : data.directional_bias === "short" || data.directional_bias === "slightly_short"
      ? SHORT_COLOR
      : "var(--text-muted)";

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Delta Exposure (DEX)
        </h2>
        <span
          className="px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            color: biasColor,
            border: `1px solid ${biasColor}`,
          }}
        >
          {biasLabel}
        </span>
      </div>

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Dealer DEX by strike
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          <line
            x1={MARGIN_X}
            x2={WIDTH - MARGIN_X}
            y1={chart.centerY}
            y2={chart.centerY}
            stroke="var(--glass-border)"
            strokeWidth={1}
          />
          {data.levels.map((lv) => {
            const h = chart.barHeight(lv.dex_usd);
            const x = chart.xOf(lv.strike) - chart.barWidth / 2;
            const y = lv.dex_usd >= 0 ? chart.centerY - h : chart.centerY;
            return (
              <rect
                key={lv.strike}
                x={x}
                y={y}
                width={chart.barWidth}
                height={h}
                fill={lv.dex_usd >= 0 ? LONG_COLOR : SHORT_COLOR}
                opacity={0.75}
              >
                <title>
                  Strike ${lv.strike.toLocaleString()} — DEX {formatUsd(lv.dex_usd)}
                </title>
              </rect>
            );
          })}
          <line
            x1={spotX}
            x2={spotX}
            y1={MARGIN_Y}
            y2={HEIGHT - MARGIN_Y}
            stroke="var(--text-primary)"
            strokeWidth={1.5}
          />
          <text
            x={spotX}
            y={MARGIN_Y - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--text-primary)"
            fontFamily="monospace"
          >
            Spot ${data.spot_price.toFixed(0)}
          </text>
        </svg>
        <div
          className="flex justify-between text-[10px] font-mono mt-1"
          style={{ color: "var(--text-muted)" }}
        >
          <span>${chart.minK.toLocaleString()}</span>
          <span>${chart.maxK.toLocaleString()}</span>
        </div>
      </GlassCard>

      <GlassCard>
        <div
          className="flex justify-between items-center mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider">
            Net DEX
          </span>
          <span
            className="text-sm font-bold font-mono"
            style={{
              color:
                data.net_dex >= 0 ? LONG_COLOR : SHORT_COLOR,
            }}
          >
            {formatUsd(data.net_dex)}
          </span>
        </div>
        <p
          className="text-sm font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          {data.interpretation}
        </p>
      </GlassCard>
    </div>
  );
}
