"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCVDData } from "@/hooks/useCVDData";
import { useAppStore } from "@/lib/store";
import { formatLargeNumber } from "@/lib/utils";

const WIDTH = 800;
const HEIGHT = 140;
const MARGIN = 10;

/**
 * Simplified CVD pane — renders a line chart of the cumulative volume delta
 * series below the main price chart. Divergence zones are shown as shaded
 * rectangles along the x-axis.
 */
export function CVDPane() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const { data, isLoading } = useCVDData(selectedAsset, "1h", 200);

  const content = useMemo(() => {
    if (!data || data.series.length === 0) return null;
    const points = data.series;

    const times = points.map((p) => p.timestamp);
    const cvds = points.map((p) => p.cvd);

    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const tSpan = maxT - minT || 1;

    const cvdMin = Math.min(...cvds);
    const cvdMax = Math.max(...cvds);
    const cvdSpan = cvdMax - cvdMin || 1;

    const xOf = (t: number) =>
      MARGIN + ((t - minT) / tSpan) * (WIDTH - 2 * MARGIN);
    const yOf = (v: number) =>
      MARGIN + ((cvdMax - v) / cvdSpan) * (HEIGHT - 2 * MARGIN);

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.timestamp)},${yOf(p.cvd)}`)
      .join(" ");

    const zeroY = yOf(0);
    const lastCvd = points[points.length - 1].cvd;
    const strokeColor =
      lastCvd >= 0 ? "var(--accent-green)" : "var(--data-red)";

    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        {/* Divergence bands */}
        {data.divergences.map((d, i) => {
          const x1 = xOf(d.startTimestamp);
          const x2 = xOf(d.endTimestamp);
          const fill =
            d.type === "bullish" ? "var(--data-green)" : "var(--data-red)";
          const opacity =
            d.severity === "severe" ? 0.18 : d.severity === "moderate" ? 0.12 : 0.06;
          return (
            <rect
              key={i}
              x={x1}
              y={MARGIN}
              width={Math.max(x2 - x1, 1)}
              height={HEIGHT - 2 * MARGIN}
              fill={fill}
              opacity={opacity}
            />
          );
        })}
        {/* Zero baseline */}
        <line
          x1={MARGIN}
          x2={WIDTH - MARGIN}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--glass-border)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth={1.5} />
      </svg>
    );
  }, [data]);

  const hasData = data && data.series.length > 0;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          CVD — Cumulative Volume Delta
        </span>
        {data && (
          <div
            className="text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {data.divergences.length} divergence
            {data.divergences.length === 1 ? "" : "s"} detected
          </div>
        )}
      </div>
      {isLoading && !data ? (
        <div
          className="h-[140px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Loading…
        </div>
      ) : hasData ? (
        <>
          {content}
          {data && data.series.length > 0 && (
            <div
              className="mt-2 flex gap-4 text-[10px] font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                Latest CVD:{" "}
                {formatLargeNumber(data.series[data.series.length - 1].cvd)}
              </span>
              {data.divergences.length > 0 && (
                <span>
                  Most recent:{" "}
                  <span
                    style={{
                      color:
                        data.divergences[data.divergences.length - 1].type ===
                        "bullish"
                          ? "var(--data-green)"
                          : "var(--data-red)",
                    }}
                  >
                    {data.divergences[data.divergences.length - 1].type}
                  </span>{" "}
                  ({data.divergences[data.divergences.length - 1].severity})
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div
          className="h-[140px] flex items-center justify-center text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          No CVD data available.
        </div>
      )}
    </GlassCard>
  );
}
