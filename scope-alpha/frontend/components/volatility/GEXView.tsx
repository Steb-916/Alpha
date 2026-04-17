"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGEX } from "@/hooks/useGEX";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { GEX_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 260;
const MARGIN_X = 40;
const MARGIN_Y = 20;

interface GEXViewProps {
  asset: string;
}

function formatUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export function GEXView({ asset }: GEXViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useGEX(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const chart = useMemo(() => {
    if (!data || data.levels.length === 0) return null;
    const strikes = data.levels.map((l) => l.strike);
    const values = data.levels.map((l) => l.gex_usd);
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

    return {
      minK,
      maxK,
      maxAbs,
      xOf,
      centerY,
      barHeight,
      barWidth,
    };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={GEX_STAGES} title="Computing gamma exposure" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data || !chart) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Gamma Exposure"
      />
    );
  }

  const spotX = chart.xOf(data.spot_price);
  const flipX = chart.xOf(data.gamma_flip);

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Gamma Exposure (GEX)
        </h2>
        <span
          className="px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background:
              data.regime === "positive_gamma"
                ? "rgba(34, 197, 94, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color:
              data.regime === "positive_gamma"
                ? "var(--data-green)"
                : "var(--data-red)",
            border: `1px solid ${data.regime === "positive_gamma" ? "var(--data-green)" : "var(--data-red)"}`,
          }}
        >
          {data.regime.replace("_", " ")}
        </span>
      </div>

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Dealer GEX by strike
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          {/* zero axis */}
          <line
            x1={MARGIN_X}
            x2={WIDTH - MARGIN_X}
            y1={chart.centerY}
            y2={chart.centerY}
            stroke="var(--glass-border)"
            strokeWidth={1}
          />
          {/* bars */}
          {data.levels.map((lv) => {
            const h = chart.barHeight(lv.gex_usd);
            const x = chart.xOf(lv.strike) - chart.barWidth / 2;
            const y = lv.gex_usd >= 0 ? chart.centerY - h : chart.centerY;
            const isPositive = lv.gex_usd >= 0;
            return (
              <rect
                key={lv.strike}
                x={x}
                y={y}
                width={chart.barWidth}
                height={h}
                fill={isPositive ? "var(--data-green)" : "var(--data-red)"}
                opacity={0.75}
              >
                <title>
                  Strike ${lv.strike.toLocaleString()} — GEX {formatUsd(lv.gex_usd)}
                </title>
              </rect>
            );
          })}
          {/* spot line */}
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
          {/* gamma flip */}
          <line
            x1={flipX}
            x2={flipX}
            y1={MARGIN_Y}
            y2={HEIGHT - MARGIN_Y}
            stroke="var(--accent-green)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={flipX}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--accent-green)"
            fontFamily="monospace"
          >
            Flip ${data.gamma_flip.toFixed(0)}
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

      <div className="grid grid-cols-3 gap-2">
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Call wall
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--data-green)" }}
          >
            ${data.call_wall.toLocaleString()}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Put wall
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--data-red)" }}
          >
            ${data.put_wall.toLocaleString()}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Total GEX
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{
              color:
                data.total_gex >= 0 ? "var(--data-green)" : "var(--data-red)",
            }}
          >
            {formatUsd(data.total_gex)}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <p
          className="text-sm font-body mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {data.regime_description}
        </p>
        <ul
          className="text-xs font-body space-y-1 list-disc list-inside"
          style={{ color: "var(--text-secondary)" }}
        >
          <li>{data.interpretation.above_spot}</li>
          <li>{data.interpretation.below_spot}</li>
          <li>{data.interpretation.regime_implications}</li>
        </ul>
      </GlassCard>
    </div>
  );
}
