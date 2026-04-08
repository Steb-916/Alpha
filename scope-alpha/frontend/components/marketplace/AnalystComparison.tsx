"use client";

/**
 * Side-by-side analyst comparison grid.
 *
 * For each metric row, finds the best and worst values across the 2-3
 * analysts and color-codes accordingly. Renders a "Best in Class" pill
 * on the winning column for each metric.
 */

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

interface AnalystComparison {
  slug: string;
  displayName: string;
  avatarInitial: string;
  tagline: string | null;
  primaryAssets: string[];
  tradingStyle: string | null;
  experienceYears: number | null;
  performance: {
    totalSignals: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    profitFactor: number;
    maxDrawdownPct: number | null;
    subscriberCount: number;
    averageRating: number | null;
    ratingCount: number;
  };
  tiers: Array<{
    name: string;
    price: number;
    features: string[];
  }>;
  recentPerformance: {
    "30d": { winRate: number; totalPnl: number; signalCount: number };
    "90d": { winRate: number; totalPnl: number; signalCount: number };
  };
}

interface Props {
  analysts: AnalystComparison[];
}

interface MetricRow {
  label: string;
  values: number[];
  // higher = better, false = lower is better (e.g. drawdown)
  higherBetter: boolean;
  format: (n: number) => string;
}

function pickBestIdx(values: number[], higherBetter: boolean): number {
  if (values.length === 0) return -1;
  let bestIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherBetter ? values[i] > values[bestIdx] : values[i] < values[bestIdx]) {
      bestIdx = i;
    }
  }
  return bestIdx;
}

function pickWorstIdx(values: number[], higherBetter: boolean): number {
  if (values.length === 0) return -1;
  let worstIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (higherBetter ? values[i] < values[worstIdx] : values[i] > values[worstIdx]) {
      worstIdx = i;
    }
  }
  return worstIdx;
}

function colorFor(idx: number, bestIdx: number, worstIdx: number, hasRange: boolean): string {
  if (!hasRange) return "var(--text-primary)";
  if (idx === bestIdx) return "#10B981";
  if (idx === worstIdx) return "#EF4444";
  return "var(--text-primary)";
}

export function AnalystComparison({ analysts }: Props) {
  if (analysts.length < 2) {
    return (
      <GlassCard>
        <div className="text-center py-8">
          <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
            Pick 2 or 3 analysts to compare.
          </p>
        </div>
      </GlassCard>
    );
  }

  const rows: MetricRow[] = [
    {
      label: "Win Rate",
      values: analysts.map((a) => a.performance.winRate),
      higherBetter: true,
      format: (n) => `${n.toFixed(1)}%`,
    },
    {
      label: "Total P&L",
      values: analysts.map((a) => a.performance.totalPnl),
      higherBetter: true,
      format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
    },
    {
      label: "Avg P&L per signal",
      values: analysts.map((a) => a.performance.avgPnl),
      higherBetter: true,
      format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
    },
    {
      label: "Profit Factor",
      values: analysts.map((a) => a.performance.profitFactor),
      higherBetter: true,
      format: (n) => n.toFixed(2),
    },
    {
      label: "Max Drawdown",
      values: analysts.map((a) => a.performance.maxDrawdownPct ?? 0),
      higherBetter: false,
      format: (n) => `${n.toFixed(2)}%`,
    },
    {
      label: "Total Signals",
      values: analysts.map((a) => a.performance.totalSignals),
      higherBetter: true,
      format: (n) => String(Math.round(n)),
    },
    {
      label: "Subscribers",
      values: analysts.map((a) => a.performance.subscriberCount),
      higherBetter: true,
      format: (n) => Math.round(n).toLocaleString(),
    },
    {
      label: "Rating",
      values: analysts.map((a) => a.performance.averageRating ?? 0),
      higherBetter: true,
      format: (n) => (n > 0 ? `${n.toFixed(1)}★` : "—"),
    },
    {
      label: "30d Win Rate",
      values: analysts.map((a) => a.recentPerformance["30d"].winRate),
      higherBetter: true,
      format: (n) => `${n.toFixed(1)}%`,
    },
    {
      label: "30d P&L",
      values: analysts.map((a) => a.recentPerformance["30d"].totalPnl),
      higherBetter: true,
      format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
    },
    {
      label: "90d Win Rate",
      values: analysts.map((a) => a.recentPerformance["90d"].winRate),
      higherBetter: true,
      format: (n) => `${n.toFixed(1)}%`,
    },
    {
      label: "90d P&L",
      values: analysts.map((a) => a.recentPerformance["90d"].totalPnl),
      higherBetter: true,
      format: (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
    },
  ];

  const colCount = analysts.length;

  return (
    <GlassCard noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <th className="text-left px-4 py-3 w-32" />
              {analysts.map((a) => (
                <th key={a.slug} className="text-left px-4 py-3" style={{ minWidth: 240 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        background: "linear-gradient(135deg, rgba(0,212,170,0.25), rgba(0,212,170,0.08))",
                        color: "var(--accent-green)",
                        border: "1.5px solid rgba(0, 212, 170, 0.35)",
                      }}
                    >
                      {a.avatarInitial}
                    </div>
                    <div>
                      <div
                        className="text-sm font-bold font-display"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {a.displayName}
                      </div>
                      {a.tagline && (
                        <div
                          className="text-[10px] font-body"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {a.tagline}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/analyst/${a.slug}`}
                    className="inline-block px-3 py-1 text-[10px] font-bold rounded-[var(--radius-sm)] no-underline"
                    style={{ background: "var(--accent-green)", color: "#fff" }}
                  >
                    View / Subscribe →
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const uniqueValues = new Set(row.values);
              const hasRange = uniqueValues.size > 1;
              const bestIdx = pickBestIdx(row.values, row.higherBetter);
              const worstIdx = pickWorstIdx(row.values, row.higherBetter);

              return (
                <tr key={row.label} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <td
                    className="px-4 py-2 text-[10px] font-body uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {row.label}
                  </td>
                  {row.values.map((v, idx) => {
                    const color = colorFor(idx, bestIdx, worstIdx, hasRange);
                    const isBest = idx === bestIdx && hasRange;
                    return (
                      <td key={idx} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color }}
                          >
                            {row.format(v)}
                          </span>
                          {isBest && (
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-[var(--radius-pill)]"
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#10B981",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                              }}
                            >
                              BEST
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Tiers row */}
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <td
                className="px-4 py-2 text-[10px] font-body uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Tiers
              </td>
              {analysts.map((a) => (
                <td key={a.slug} className="px-4 py-2">
                  {a.tiers.length === 0 ? (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      —
                    </span>
                  ) : (
                    <div className="space-y-1">
                      {a.tiers.map((t) => (
                        <div key={t.name} className="text-[11px] font-mono">
                          <span style={{ color: "var(--accent-green)" }}>${t.price}</span>
                          <span style={{ color: "var(--text-muted)" }}> · {t.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
