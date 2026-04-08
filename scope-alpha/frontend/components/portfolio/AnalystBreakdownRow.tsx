"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PortfolioSummary } from "@/lib/portfolio/summary";

interface Props {
  summary: PortfolioSummary;
}

export function AnalystBreakdownRow({ summary }: Props) {
  if (summary.byAnalyst.length === 0) return null;

  return (
    <GlassCard noPadding>
      <div
        className="px-4 py-2 text-[10px] font-bold font-body uppercase tracking-wider"
        style={{
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        By Analyst
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {summary.byAnalyst.map((b) => (
          <Link
            key={b.analyst.slug}
            href={`/analyst/${b.analyst.slug}`}
            className="flex items-center gap-2 p-2 rounded-[var(--radius-sm)] no-underline"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: "rgba(0,212,170,0.15)",
                color: "var(--accent-green)",
                border: "1px solid rgba(0, 212, 170, 0.3)",
              }}
            >
              {b.analyst.avatarInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-bold font-display truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {b.analyst.displayName}
              </div>
              <div
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {b.trackedCount} tracked · win {b.winRate.toFixed(0)}%
              </div>
            </div>
            <div
              className="text-xs font-mono font-bold"
              style={{ color: b.closedPnl >= 0 ? "#10B981" : "#EF4444" }}
            >
              {b.closedPnl >= 0 ? "+" : ""}
              {b.closedPnl.toFixed(2)}%
            </div>
          </Link>
        ))}
      </div>
    </GlassCard>
  );
}
