"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGreeksExposure } from "@/hooks/useGreeksExposure";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { VANNA_CHARM_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 180;
const MARGIN_X = 40;
const MARGIN_Y = 16;

interface VannaCharmViewProps {
  asset: string;
}

function buildChart(
  levels: Array<{ strike: number; value: number }>,
  spot: number,
) {
  if (levels.length === 0) return null;
  const strikes = levels.map((l) => l.strike);
  const values = levels.map((l) => l.value);
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
  return { minK, maxK, xOf, centerY, barHeight, barWidth, spotX: xOf(spot) };
}

interface PanelProps {
  title: string;
  levels: Array<{ strike: number; value: number }>;
  spot: number;
  positiveColor: string;
  negativeColor: string;
}

function Panel({
  title,
  levels,
  spot,
  positiveColor,
  negativeColor,
}: PanelProps) {
  const chart = useMemo(() => buildChart(levels, spot), [levels, spot]);
  if (!chart) return null;
  return (
    <>
      <div
        className="text-xs font-mono uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
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
        {levels.map((lv) => {
          const h = chart.barHeight(lv.value);
          const x = chart.xOf(lv.strike) - chart.barWidth / 2;
          const y = lv.value >= 0 ? chart.centerY - h : chart.centerY;
          return (
            <rect
              key={lv.strike}
              x={x}
              y={y}
              width={chart.barWidth}
              height={h}
              fill={lv.value >= 0 ? positiveColor : negativeColor}
              opacity={0.75}
            >
              <title>
                Strike ${lv.strike.toLocaleString()} — {lv.value.toFixed(2)}
              </title>
            </rect>
          );
        })}
        <line
          x1={chart.spotX}
          x2={chart.spotX}
          y1={MARGIN_Y}
          y2={HEIGHT - MARGIN_Y}
          stroke="var(--text-primary)"
          strokeWidth={1.5}
        />
      </svg>
    </>
  );
}

export function VannaCharmView({ asset }: VannaCharmViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useGreeksExposure(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader
        stages={VANNA_CHARM_STAGES}
        title="Computing vanna / charm"
      />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Vanna / Charm"
      />
    );
  }

  const vannaLevels = data.vanna.levels.map((l) => ({
    strike: l.strike,
    value: l.vanna_exposure,
  }));
  const charmLevels = data.charm.levels.map((l) => ({
    strike: l.strike,
    value: l.charm_exposure,
  }));

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2
        className="text-sm font-bold font-display"
        style={{ color: "var(--text-primary)" }}
      >
        Vanna &amp; Charm Exposure
      </h2>

      <GlassCard>
        <Panel
          title="Vanna — dealer delta sensitivity to IV"
          levels={vannaLevels}
          spot={data.spot_price}
          positiveColor="#a855f7"
          negativeColor="#eab308"
        />
        <div
          className="flex justify-between items-center mt-2 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>Net vanna</span>
          <span
            style={{
              color:
                data.vanna.net_vanna >= 0 ? "#a855f7" : "#eab308",
            }}
          >
            {data.vanna.net_vanna.toFixed(0)}
          </span>
        </div>
        <p
          className="text-sm font-body mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {data.vanna.interpretation}
        </p>
      </GlassCard>

      <GlassCard>
        <Panel
          title="Charm — time-decay impact on dealer delta"
          levels={charmLevels}
          spot={data.spot_price}
          positiveColor="var(--data-green)"
          negativeColor="var(--data-red)"
        />
        <div
          className="flex justify-between items-center mt-2 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>Net charm — {data.charm.time_decay_bias}</span>
          <span
            style={{
              color:
                data.charm.time_decay_bias === "bullish"
                  ? "var(--data-green)"
                  : data.charm.time_decay_bias === "bearish"
                    ? "var(--data-red)"
                    : "var(--text-muted)",
            }}
          >
            {data.charm.net_charm.toFixed(0)}
          </span>
        </div>
        <p
          className="text-sm font-body mt-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {data.charm.interpretation}
        </p>
      </GlassCard>
    </div>
  );
}
