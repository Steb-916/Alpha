"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGEXHistory } from "@/hooks/useGEXHistory";

interface GEXHeatmapProps {
  asset: string;
  days?: number;
}

const WIDTH = 800;
const HEIGHT = 280;
const MARGIN_LEFT = 56;
const MARGIN_BOTTOM = 28;
const MARGIN_TOP = 16;
const MARGIN_RIGHT = 12;

function colorFor(value: number, maxAbs: number): string {
  if (maxAbs <= 0 || !Number.isFinite(value)) return "transparent";
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  if (value >= 0) {
    return `rgba(34, 197, 94, ${intensity * 0.85})`;
  }
  return `rgba(239, 68, 68, ${intensity * 0.85})`;
}

export function GEXHeatmap({ asset, days = 7 }: GEXHeatmapProps) {
  const { data, isLoading } = useGEXHistory(asset, days);

  const grid = useMemo(() => {
    if (!data || data.points.length === 0) return null;
    const allStrikes = new Set<number>();
    let maxAbs = 0;
    for (const p of data.points) {
      for (const lv of p.levels) {
        allStrikes.add(lv.strike);
        if (Math.abs(lv.gex_usd) > maxAbs) maxAbs = Math.abs(lv.gex_usd);
      }
    }
    const strikes = Array.from(allStrikes).sort((a, b) => a - b);
    const times = data.points.map((p) => new Date(p.timestamp).getTime());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const cellW = (WIDTH - MARGIN_LEFT - MARGIN_RIGHT) / Math.max(data.points.length, 1);
    const cellH = (HEIGHT - MARGIN_TOP - MARGIN_BOTTOM) / Math.max(strikes.length, 1);

    const cells: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      strike: number;
      timestamp: string;
      value: number;
    }> = [];

    data.points.forEach((p, i) => {
      const byStrike = new Map(p.levels.map((l) => [l.strike, l.gex_usd]));
      strikes.forEach((k, j) => {
        const v = byStrike.get(k) ?? 0;
        if (v === 0) return;
        cells.push({
          x: MARGIN_LEFT + i * cellW,
          // reverse Y so high strikes render at top
          y: MARGIN_TOP + (strikes.length - 1 - j) * cellH,
          w: cellW,
          h: cellH,
          strike: k,
          timestamp: p.timestamp,
          value: v,
        });
      });
    });

    const spotLine: Array<{ x: number; y: number }> = data.points.map(
      (p, i) => {
        const nearest = strikes.reduce((best, k) =>
          Math.abs(k - p.spot_price) < Math.abs(best - p.spot_price) ? k : best,
        strikes[0]);
        const j = strikes.indexOf(nearest);
        return {
          x: MARGIN_LEFT + i * cellW + cellW / 2,
          y:
            MARGIN_TOP +
            (strikes.length - 1 - j) * cellH +
            cellH / 2,
        };
      },
    );

    return { cells, strikes, minT, maxT, cellW, cellH, spotLine, maxAbs };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <div
          className="text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Loading GEX history…
        </div>
      </GlassCard>
    );
  }
  if (!data || data.points.length === 0 || !grid) {
    return (
      <GlassCard>
        <div
          className="text-xs font-mono text-center py-8"
          style={{ color: "var(--text-muted)" }}
        >
          No GEX history yet. The heatmap populates once the cron has written
          at least one hourly snapshot.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div
        className="text-xs font-mono uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        GEX over time — last {days}d
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        {grid.cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            fill={colorFor(c.value, grid.maxAbs)}
          >
            <title>
              ${c.strike.toLocaleString()} · {new Date(c.timestamp).toLocaleString()}
              {"\n"}GEX {c.value.toFixed(0)}
            </title>
          </rect>
        ))}
        {/* Spot-price line */}
        <polyline
          points={grid.spotLine.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth={1.5}
          opacity={0.8}
        />
        {/* Y-axis labels (strikes) */}
        {grid.strikes.length > 0 && (
          <>
            <text
              x={4}
              y={MARGIN_TOP + 10}
              fontSize={9}
              fontFamily="monospace"
              fill="var(--text-muted)"
            >
              ${grid.strikes[grid.strikes.length - 1].toLocaleString()}
            </text>
            <text
              x={4}
              y={HEIGHT - MARGIN_BOTTOM - 2}
              fontSize={9}
              fontFamily="monospace"
              fill="var(--text-muted)"
            >
              ${grid.strikes[0].toLocaleString()}
            </text>
          </>
        )}
        {/* X-axis labels (time range) */}
        <text
          x={MARGIN_LEFT}
          y={HEIGHT - 8}
          fontSize={9}
          fontFamily="monospace"
          fill="var(--text-muted)"
        >
          {new Date(grid.minT).toLocaleDateString()}
        </text>
        <text
          x={WIDTH - MARGIN_RIGHT}
          y={HEIGHT - 8}
          textAnchor="end"
          fontSize={9}
          fontFamily="monospace"
          fill="var(--text-muted)"
        >
          {new Date(grid.maxT).toLocaleDateString()}
        </text>
      </svg>
      <div
        className="flex items-center justify-center gap-4 text-[10px] font-mono mt-2"
        style={{ color: "var(--text-muted)" }}
      >
        <span style={{ color: "var(--data-red)" }}>■ negative gamma</span>
        <span style={{ color: "var(--data-green)" }}>■ positive gamma</span>
        <span>— spot path</span>
      </div>
    </GlassCard>
  );
}
