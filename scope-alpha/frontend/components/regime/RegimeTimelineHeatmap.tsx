"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  REGIME_COLORS,
  REGIME_LABELS_SHORT,
} from "@/lib/regime/regime-colors";
import type {
  RegimeHistoryPoint,
  RegimeLabel,
} from "@/types/regime";

const STRIP_HEIGHT = 36;
const STRIP_WIDTH = 1000;

interface Props {
  points: RegimeHistoryPoint[];
  days: number;
}

/**
 * 90-day horizontal strip. One rect per persisted observation, colored
 * by committed regime. Day-one shows sparse stripes — the 90d width is
 * full only after 2,160 hourly cron runs (90 days).
 */
export function RegimeTimelineHeatmap({ points, days }: Props) {
  const geom = useMemo(() => {
    if (points.length === 0) return null;
    const first = new Date(points[0].timestamp).getTime();
    const last = new Date(points[points.length - 1].timestamp).getTime();
    // Clamp the axis to the requested `days` window — anchors the strip
    // even when persisted depth is shallow.
    const windowStart = last - days * 24 * 60 * 60 * 1000;
    const axisStart = Math.min(windowStart, first);
    const axisEnd = last;
    const span = Math.max(1, axisEnd - axisStart);
    const xOf = (iso: string) => {
      const t = new Date(iso).getTime();
      return ((t - axisStart) / span) * STRIP_WIDTH;
    };
    const widthOf = (iso: string) => {
      // Each hourly slice gets 1h-of-span width minimum
      return Math.max(2, (STRIP_WIDTH * (3600_000)) / span);
    };
    return { xOf, widthOf, axisStart, axisEnd };
  }, [points, days]);

  if (!geom || points.length === 0) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          90-day regime timeline (no history yet — accumulates as the classifier
          cron runs hourly).
        </div>
      </GlassCard>
    );
  }

  // Legend: show only the regimes that actually appear in the window
  const presentRegimes = Array.from(
    new Set(points.map((p) => p.committed_regime as RegimeLabel)),
  );

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {days}-day regime timeline
        </div>
        <div className="flex gap-3 text-[10px] font-mono">
          {presentRegimes.map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span
                className="inline-block"
                style={{
                  background: REGIME_COLORS[r],
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                }}
              />
              <span style={{ color: "var(--text-muted)" }}>
                {REGIME_LABELS_SHORT[r]}
              </span>
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: STRIP_HEIGHT }}
      >
        {points.map((p, i) => {
          const x = geom.xOf(p.timestamp);
          const w = geom.widthOf(p.timestamp);
          const regime = p.committed_regime as RegimeLabel;
          return (
            <rect
              key={`${p.timestamp}-${i}`}
              x={x}
              y={0}
              width={w}
              height={STRIP_HEIGHT}
              fill={REGIME_COLORS[regime]}
              opacity={0.9}
            >
              <title>
                {new Date(p.timestamp).toUTCString()} — {regime}
                {" "}({Math.round(p.confidence * 100)}% confidence)
              </title>
            </rect>
          );
        })}
        {/* Transition markers */}
        {points
          .filter((p) => p.regime_changed)
          .map((p, i) => {
            const x = geom.xOf(p.timestamp);
            return (
              <line
                key={`transition-${i}`}
                x1={x}
                x2={x}
                y1={0}
                y2={STRIP_HEIGHT}
                stroke="var(--text-primary)"
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}
      </svg>
      <div
        className="mt-1 text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        Vertical marks = regime transitions (committed after 2-of-2 agreement;
        capitulation commits instantly).
      </div>
    </GlassCard>
  );
}
