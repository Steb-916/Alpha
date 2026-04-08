"use client";

/**
 * Stat cards for the portfolio dashboard header.
 *
 * Renders 5 cards: Closed P&L, Active count, Win rate, Best/Worst trade,
 * Total tracked.
 */

import { GlassCard } from "@/components/ui/GlassCard";
import type { PortfolioSummary } from "@/lib/portfolio/summary";

interface Props {
  summary: PortfolioSummary;
  unrealizedTotal: number;
}

interface CardSpec {
  label: string;
  value: string;
  color: string;
  sub?: string;
}

export function PortfolioSummaryCards({ summary, unrealizedTotal }: Props) {
  const closedTotal = summary.closedPnl.total;
  const grandTotal = closedTotal + unrealizedTotal;

  const cards: CardSpec[] = [
    {
      label: "Total P&L",
      value: `${grandTotal >= 0 ? "+" : ""}${grandTotal.toFixed(2)}%`,
      color: grandTotal >= 0 ? "#10B981" : "#EF4444",
      sub: `Closed ${closedTotal >= 0 ? "+" : ""}${closedTotal.toFixed(2)}% / Open ${unrealizedTotal >= 0 ? "+" : ""}${unrealizedTotal.toFixed(2)}%`,
    },
    {
      label: "Active Positions",
      value: String(summary.activePositions),
      color: "var(--accent-blue, #3B82F6)",
      sub: `${summary.totalTracked} tracked total`,
    },
    {
      label: "Win Rate",
      value:
        summary.closedPnl.wins + summary.closedPnl.losses === 0
          ? "—"
          : `${summary.closedPnl.winRate.toFixed(1)}%`,
      color: summary.closedPnl.winRate >= 50 ? "#10B981" : "#EF4444",
      sub: `${summary.closedPnl.wins}W / ${summary.closedPnl.losses}L`,
    },
    {
      label: "Best Trade",
      value:
        summary.closedPnl.bestTrade === 0
          ? "—"
          : `${summary.closedPnl.bestTrade >= 0 ? "+" : ""}${summary.closedPnl.bestTrade.toFixed(2)}%`,
      color: "#10B981",
    },
    {
      label: "Worst Trade",
      value:
        summary.closedPnl.worstTrade === 0
          ? "—"
          : `${summary.closedPnl.worstTrade.toFixed(2)}%`,
      color: "#EF4444",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <GlassCard key={c.label}>
          <div
            className="text-[10px] font-bold font-body uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {c.label}
          </div>
          <div
            className="text-xl font-bold font-mono"
            style={{ color: c.color }}
          >
            {c.value}
          </div>
          {c.sub && (
            <div
              className="text-[9px] font-body mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {c.sub}
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
