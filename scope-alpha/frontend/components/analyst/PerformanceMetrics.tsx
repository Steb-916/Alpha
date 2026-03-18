"use client";

import type { PerformanceMetrics } from "@/lib/performanceCalc";
import { DataCell } from "@/components/ui/DataCell";

interface Props {
  metrics: PerformanceMetrics;
}

export function PerformanceMetricsGrid({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <DataCell
        label="Win Rate"
        value={metrics.winRate !== null ? `${metrics.winRate}%` : "—"}
        color={
          metrics.winRate !== null && metrics.winRate >= 50
            ? "var(--accent-green)"
            : metrics.winRate !== null
            ? "var(--accent-red)"
            : undefined
        }
      />
      <DataCell
        label="Avg P&L"
        value={
          metrics.avgPnlPercent !== null
            ? `${metrics.avgPnlPercent >= 0 ? "+" : ""}${metrics.avgPnlPercent}%`
            : "—"
        }
        color={
          metrics.avgPnlPercent !== null && metrics.avgPnlPercent >= 0
            ? "var(--accent-green)"
            : metrics.avgPnlPercent !== null
            ? "var(--accent-red)"
            : undefined
        }
      />
      <DataCell
        label="Profit Factor"
        value={metrics.profitFactor !== null ? `${metrics.profitFactor}` : "—"}
        color={
          metrics.profitFactor !== null && metrics.profitFactor >= 1
            ? "var(--accent-green)"
            : metrics.profitFactor !== null
            ? "var(--accent-red)"
            : undefined
        }
      />
      <DataCell
        label="Avg R:R"
        value={metrics.avgRrRatio !== null ? `${metrics.avgRrRatio}R` : "—"}
      />
      <DataCell
        label="Total Signals"
        value={`${metrics.totalSignals}`}
      />
      <DataCell
        label="Active Now"
        value={`${metrics.activeSignals}`}
        color="var(--accent-blue)"
      />
      <DataCell
        label="Win / Loss"
        value={`${metrics.winCount} / ${metrics.lossCount}`}
      />
      <DataCell
        label="Streaks"
        value={`${metrics.bestStreak}W / ${metrics.worstStreak}L`}
        color="var(--text-secondary)"
      />
    </div>
  );
}
