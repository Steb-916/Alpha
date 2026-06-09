"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { BacktestStats } from "@/lib/analytics/backtest-engine";

function StatCell({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="p-3">
      <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p
        className="text-lg font-bold font-mono mt-0.5"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function pctColor(v: number): string {
  if (v > 0) return "var(--accent-green)";
  if (v < 0) return "var(--data-red)";
  return "var(--text-secondary)";
}

export function BacktestStatsPanel({ stats }: { stats: BacktestStats }) {
  const pfStr =
    stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2);

  return (
    <GlassCard noPadding>
      <div className="grid grid-cols-4 divide-x divide-[var(--glass-border)]">
        <StatCell
          label="Total Return"
          value={`${stats.totalReturn >= 0 ? "+" : ""}${stats.totalReturn.toFixed(1)}%`}
          color={pctColor(stats.totalReturn)}
          sub={`CAGR ${stats.cagr.toFixed(1)}%`}
        />
        <StatCell
          label="Sharpe / Sortino"
          value={`${stats.sharpe.toFixed(2)} / ${stats.sortino.toFixed(2)}`}
          color={stats.sharpe > 1 ? "var(--accent-green)" : stats.sharpe > 0 ? "var(--data-yellow)" : "var(--data-red)"}
        />
        <StatCell
          label="Max Drawdown"
          value={`-${stats.maxDrawdown.toFixed(1)}%`}
          color={stats.maxDrawdown > 30 ? "var(--data-red)" : "var(--data-yellow)"}
        />
        <StatCell
          label="Profit Factor"
          value={pfStr}
          color={stats.profitFactor > 1.5 ? "var(--accent-green)" : stats.profitFactor > 1 ? "var(--data-yellow)" : "var(--data-red)"}
        />
      </div>
      <div
        className="grid grid-cols-4 divide-x divide-[var(--glass-border)]"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        <StatCell
          label="Total Trades"
          value={String(stats.totalTrades)}
          sub={`${stats.daysInMarket.toFixed(0)}% time in market`}
        />
        <StatCell
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          color={stats.winRate > 55 ? "var(--accent-green)" : stats.winRate > 40 ? "var(--data-yellow)" : "var(--data-red)"}
        />
        <StatCell
          label="Avg Win"
          value={`+${stats.avgWin.toFixed(2)}%`}
          color="var(--accent-green)"
        />
        <StatCell
          label="Avg Loss"
          value={`-${stats.avgLoss.toFixed(2)}%`}
          color="var(--data-red)"
        />
      </div>
    </GlassCard>
  );
}
