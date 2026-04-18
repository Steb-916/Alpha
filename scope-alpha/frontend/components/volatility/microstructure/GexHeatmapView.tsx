"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPill } from "@/components/ui/GlassPill";
import { useGexHeatmap } from "@/hooks/useGexHeatmap";
import { UnavailableBanner } from "../UnavailableBanner";
import type { GexStrike } from "@/types/options";

const LOOKBACK_ITEMS = [
  { label: "7d", value: "7d" },
  { label: "14d", value: "14d" },
  { label: "30d", value: "30d" },
] as const;

type Lookback = "7d" | "14d" | "30d";

interface Props { asset: string }

export function GexHeatmapView({ asset }: Props) {
  const [lookback, setLookback] = useState<Lookback>("30d");
  const { data, isLoading, unavailable, quantEngineConfigured } = useGexHeatmap(asset, lookback);

  const grid = useMemo(() => {
    if (!data || data.dataPoints < 1) return null;

    // Collect all unique strikes across all snapshots
    const strikeSet = new Set<number>();
    for (const snap of data.snapshots) {
      for (const s of snap.strikes) strikeSet.add(s.strike);
    }
    const strikes = Array.from(strikeSet).sort((a, b) => b - a); // descending (top = high)

    // Build lookup: timestamp → strike → netGex
    const lookup = new Map<string, Map<number, number>>();
    for (const snap of data.snapshots) {
      const m = new Map<number, number>();
      for (const s of snap.strikes as GexStrike[]) m.set(s.strike, s.netGex);
      lookup.set(snap.timestamp, m);
    }

    const times = data.snapshots.map((s) => s.timestamp);
    const allGex = data.snapshots.flatMap((s) => (s.strikes as GexStrike[]).map((x) => Math.abs(x.netGex)));
    const maxAbs = Math.max(...allGex, 1);

    return { strikes, times, lookup, maxAbs };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="GEX Heatmap" />;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          GEX Heatmap Over Time — {asset}
        </h2>
        <GlassPill
          items={LOOKBACK_ITEMS as unknown as { label: string; value: string }[]}
          activeValue={lookback}
          onChange={(v) => setLookback(v as Lookback)}
        />
      </div>

      {!grid || data!.dataPoints < 3 ? (
        <GlassCard>
          <p className="text-sm font-body text-center py-8" style={{ color: "var(--text-secondary)" }}>
            Building historical data — check back after the next few refresh cycles.
          </p>
          <p className="text-[10px] font-mono text-center" style={{ color: "var(--text-muted)" }}>
            {data?.dataPoints ?? 0} snapshot{data?.dataPoints !== 1 ? "s" : ""} available
          </p>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Strike (Y) × Time (X) — color intensity = GEX magnitude
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(grid.times.length * 12 + 60, 400)} ${grid.strikes.length * 10 + 20}`}
              className="w-full"
              style={{ minWidth: 400 }}
            >
              {grid.strikes.map((strike, si) =>
                grid.times.map((t, ti) => {
                  const gex = grid.lookup.get(t)?.get(strike) ?? 0;
                  const opacity = Math.min(0.9, Math.abs(gex) / grid.maxAbs);
                  const fill = gex >= 0 ? `rgba(0,212,170,${opacity})` : `rgba(239,68,68,${opacity})`;
                  return (
                    <rect
                      key={`${si}-${ti}`}
                      x={60 + ti * 12}
                      y={si * 10}
                      width={11}
                      height={9}
                      fill={fill}
                      rx={1}
                    >
                      <title>{`${t.slice(0, 10)} · $${strike.toLocaleString()} · GEX: ${gex.toExponential(2)}`}</title>
                    </rect>
                  );
                })
              )}
              {/* Strike labels (y-axis) */}
              {grid.strikes.filter((_, i) => i % 5 === 0).map((strike, si) => (
                <text
                  key={strike}
                  x={56}
                  y={si * 5 * 10 + 8}
                  textAnchor="end"
                  fontSize={7}
                  fill="var(--text-muted)"
                >
                  {strike >= 1000 ? `${(strike / 1000).toFixed(0)}k` : strike}
                </text>
              ))}
            </svg>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(0,212,170,0.7)" }} />Positive GEX</span>
            <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(239,68,68,0.7)" }} />Negative GEX</span>
            <span style={{ marginLeft: "auto" }}>{data!.dataPoints} snapshots</span>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
