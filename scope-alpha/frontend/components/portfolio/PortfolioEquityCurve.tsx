"use client";

/**
 * Portfolio equity curve. Wraps the existing CumulativePnlChart from
 * components/analyst/PerformanceCharts.tsx with the portfolio's
 * `summary.equityCurve` data, mapped into the shape that chart expects.
 */

import { CumulativePnlChart } from "@/components/analyst/PerformanceCharts";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PortfolioSummary } from "@/lib/portfolio/summary";

interface Props {
  summary: PortfolioSummary;
}

export function PortfolioEquityCurve({ summary }: Props) {
  if (summary.equityCurve.length < 2) {
    return (
      <GlassCard>
        <div
          className="text-[10px] font-bold font-body uppercase tracking-wider mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          Portfolio Equity Curve
        </div>
        <div
          className="flex items-center justify-center h-[160px] text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Close at least 2 positions to plot the equity curve.
        </div>
      </GlassCard>
    );
  }

  // CumulativePnlChart expects { date, pnl }[].
  const data = summary.equityCurve.map((p) => ({
    date: p.date,
    pnl: p.cumulativePnl,
  }));

  return <CumulativePnlChart data={data} />;
}
