"use client";

/**
 * Four glass stat cards (7d / 30d / 90d / All) showing winRate + totalPnl
 * + signal count + a delta arrow vs the previous period of equal length.
 *
 * Wires to /api/analysts/[slug]/performance/rolling via SWR.
 */

import useSWR from "swr";
import type { RollingPerformance, WindowMetrics } from "@/lib/analytics/rolling";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  slug: string;
}

const WINDOWS: Array<{ key: keyof RollingPerformance["windows"]; label: string; comparisonKey?: keyof RollingPerformance["comparison"] }> = [
  { key: "7d", label: "7 Days", comparisonKey: "7d_vs_prev" },
  { key: "30d", label: "30 Days", comparisonKey: "30d_vs_prev" },
  { key: "90d", label: "90 Days", comparisonKey: "90d_vs_prev" },
  { key: "all", label: "All Time" },
];

export function RollingWindowCards({ slug }: Props) {
  const { data, error } = useSWR<RollingPerformance>(
    `/api/analysts/${slug}/performance/rolling`,
    fetcher,
  );

  if (error) {
    return null;
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {WINDOWS.map((w) => {
        const metrics: WindowMetrics | undefined = data?.windows[w.key];
        const comparison = w.comparisonKey ? data?.comparison[w.comparisonKey] : undefined;
        return (
          <GlassCard key={w.key}>
            <div
              className="text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {w.label}
            </div>

            {!metrics ? (
              <div className="h-16 flex items-center">
                <div
                  className="h-3 w-16 rounded animate-pulse"
                  style={{ background: "var(--glass-bg)" }}
                />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xl font-bold font-mono"
                    style={{
                      color: metrics.totalPnl >= 0 ? "#10B981" : "#EF4444",
                    }}
                  >
                    {metrics.totalPnl >= 0 ? "+" : ""}
                    {metrics.totalPnl.toFixed(2)}%
                  </span>
                  {comparison && metrics.totalSignals > 0 && (
                    <span
                      className="text-[10px] font-mono"
                      style={{
                        color:
                          comparison.pnlDelta >= 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {comparison.pnlDelta >= 0 ? "▲" : "▼"}{" "}
                      {Math.abs(comparison.pnlDelta).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-body mt-1" style={{ color: "var(--text-muted)" }}>
                  {metrics.totalSignals} signals
                  {" · "}
                  Win rate{" "}
                  <span style={{ color: metrics.winRate >= 50 ? "#10B981" : "#EF4444" }}>
                    {metrics.winRate.toFixed(0)}%
                  </span>
                </div>
              </>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
