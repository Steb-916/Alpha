"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useVolCone } from "@/hooks/useVolCone";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { VOL_CONE_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 260;
const MARGIN_X = 40;
const MARGIN_Y = 14;

interface VolConeViewProps {
  asset: string;
}

export function VolConeView({ asset }: VolConeViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useVolCone(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const chart = useMemo(() => {
    if (!data) return null;
    const windows = [...data.windows].sort((a, b) => a.days - b.days);
    if (windows.length === 0) return null;
    const allValues = windows.flatMap((w) => [
      w.percentiles.p10,
      w.percentiles.p90,
      w.current_rv,
    ]);
    const minY = Math.min(...allValues, data.current_atm_iv);
    const maxY = Math.max(...allValues, data.current_atm_iv);
    const range = maxY - minY || 1;

    const innerW = WIDTH - 2 * MARGIN_X;
    const innerH = HEIGHT - 2 * MARGIN_Y;
    const step = innerW / Math.max(1, windows.length - 1);

    const xOf = (i: number) => MARGIN_X + i * step;
    const yOf = (v: number) =>
      HEIGHT - MARGIN_Y - ((v - minY) / range) * innerH;

    return { windows, xOf, yOf, minY, maxY };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={VOL_CONE_STAGES} title="Computing vol cone" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data || !chart) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Vol Cone"
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2
        className="text-sm font-bold font-display"
        style={{ color: "var(--text-primary)" }}
      >
        Volatility Cone — {asset}
      </h2>

      <GlassCard>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          {/* P10-P90 outer band */}
          <polygon
            points={[
              ...chart.windows.map(
                (w, i) => `${chart.xOf(i)},${chart.yOf(w.percentiles.p90)}`,
              ),
              ...[...chart.windows].reverse().map((w, idx) => {
                const i = chart.windows.length - 1 - idx;
                return `${chart.xOf(i)},${chart.yOf(w.percentiles.p10)}`;
              }),
            ].join(" ")}
            fill="var(--data-blue)"
            fillOpacity={0.12}
          />
          {/* P25-P75 inner band */}
          <polygon
            points={[
              ...chart.windows.map(
                (w, i) => `${chart.xOf(i)},${chart.yOf(w.percentiles.p75)}`,
              ),
              ...[...chart.windows].reverse().map((w, idx) => {
                const i = chart.windows.length - 1 - idx;
                return `${chart.xOf(i)},${chart.yOf(w.percentiles.p25)}`;
              }),
            ].join(" ")}
            fill="var(--data-blue)"
            fillOpacity={0.22}
          />
          {/* Median line */}
          <polyline
            points={chart.windows
              .map((w, i) => `${chart.xOf(i)},${chart.yOf(w.percentiles.p50)}`)
              .join(" ")}
            fill="none"
            stroke="var(--data-blue)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          {/* Current RV dots */}
          {chart.windows.map((w, i) => (
            <circle
              key={w.days}
              cx={chart.xOf(i)}
              cy={chart.yOf(w.current_rv)}
              r={4}
              fill="var(--accent-green)"
            >
              <title>
                {w.days}d RV {w.current_rv.toFixed(1)}%
              </title>
            </circle>
          ))}
          {/* Current ATM IV horizontal line */}
          <line
            x1={MARGIN_X}
            x2={WIDTH - MARGIN_X}
            y1={chart.yOf(data.current_atm_iv)}
            y2={chart.yOf(data.current_atm_iv)}
            stroke="var(--data-yellow)"
            strokeWidth={1.5}
          />
        </svg>
        <div className="flex justify-between mt-1 px-[40px]">
          {chart.windows.map((w) => (
            <span
              key={w.days}
              className="text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {w.days}d
            </span>
          ))}
        </div>
        <div
          className="flex gap-4 mt-3 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          <span>
            <span
              className="inline-block w-3 h-3 mr-1 align-middle"
              style={{ background: "var(--data-blue)", opacity: 0.22 }}
            />
            P25–P75 band
          </span>
          <span>
            <span
              className="inline-block w-3 h-3 mr-1 align-middle"
              style={{ background: "var(--data-blue)", opacity: 0.12 }}
            />
            P10–P90 band
          </span>
          <span>
            <span
              className="inline-block w-3 h-3 rounded-full mr-1 align-middle"
              style={{ background: "var(--accent-green)" }}
            />
            Current RV
          </span>
          <span>
            <span
              className="inline-block w-4 h-[2px] mr-1 align-middle"
              style={{ background: "var(--data-yellow)" }}
            />
            Current ATM IV ({data.current_atm_iv.toFixed(1)}%)
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
