/**
 * Portfolio summary computation.
 *
 * Pure function — takes a list of TrackedSignal rows (already joined with
 * the underlying signal + analyst) and returns the aggregate stats the
 * portfolio dashboard renders.
 *
 * Reuses the existing Phase 4 metrics module by mapping each closed
 * position into a `SignalLike` shape (`personalPnl` → `resultPnlPercent`,
 * `closedAt` → `resolvedAt`).
 */

import {
  avgPnl,
  bestTrade,
  cumulativePnl,
  totalPnl,
  winRate,
  worstTrade,
  type SignalLike,
} from '@/lib/analytics/metrics';

export interface PortfolioPosition {
  id: string;
  signalId: string;
  analystId: string;
  status: string;
  takenAt: Date | string;
  closedAt: Date | string | null;
  personalPnl: number | null;
  signal: {
    assetSymbol: string;
    direction: string;
  };
  analyst: {
    slug: string;
    displayName: string;
    avatarInitial: string;
  };
}

export interface PortfolioSummary {
  totalTracked: number;
  activePositions: number;
  closedPositions: number;
  closedPnl: {
    total: number;
    avgPnl: number;
    winRate: number;
    wins: number;
    losses: number;
    bestTrade: number;
    worstTrade: number;
  };
  byAnalyst: Array<{
    analyst: { slug: string; displayName: string; avatarInitial: string };
    trackedCount: number;
    closedPnl: number;
    winRate: number;
  }>;
  equityCurve: Array<{ date: string; cumulativePnl: number }>;
}

/** Map a portfolio position into a SignalLike for the metrics module. */
function toSignalLike(p: PortfolioPosition): SignalLike {
  return {
    resultPnlPercent: p.personalPnl,
    resolvedAt: p.closedAt,
    status: p.status,
  };
}

export function computePortfolioSummary(
  positions: PortfolioPosition[],
): PortfolioSummary {
  const closed = positions.filter((p) => p.status === 'closed');
  const closedLikes = closed.map(toSignalLike);

  const wins = closedLikes.filter((s) => (s.resultPnlPercent ?? 0) > 0).length;
  const losses = closedLikes.filter((s) => (s.resultPnlPercent ?? 0) < 0).length;

  // byAnalyst groups closed positions by analystId.
  const byAnalystMap = new Map<
    string,
    {
      analyst: { slug: string; displayName: string; avatarInitial: string };
      trackedCount: number;
      closedPnls: number[];
    }
  >();
  for (const p of positions) {
    const existing = byAnalystMap.get(p.analystId);
    const closedContribution = p.status === 'closed' && p.personalPnl != null ? p.personalPnl : null;
    if (existing) {
      existing.trackedCount += 1;
      if (closedContribution != null) existing.closedPnls.push(closedContribution);
    } else {
      byAnalystMap.set(p.analystId, {
        analyst: p.analyst,
        trackedCount: 1,
        closedPnls: closedContribution != null ? [closedContribution] : [],
      });
    }
  }

  const byAnalyst = Array.from(byAnalystMap.values()).map((entry) => ({
    analyst: entry.analyst,
    trackedCount: entry.trackedCount,
    closedPnl:
      entry.closedPnls.length === 0
        ? 0
        : Math.round(entry.closedPnls.reduce((s, x) => s + x, 0) * 10000) / 10000,
    winRate:
      entry.closedPnls.length === 0
        ? 0
        : Math.round(
            (entry.closedPnls.filter((x) => x > 0).length / entry.closedPnls.length) *
              100 *
              100,
          ) / 100,
  }));

  // Equity curve from closed positions.
  const cumPoints = cumulativePnl(closedLikes);
  const equityCurve = cumPoints.map((p) => ({
    date: p.date,
    cumulativePnl: p.cumulative,
  }));

  return {
    totalTracked: positions.length,
    activePositions: positions.length - closed.length,
    closedPositions: closed.length,
    closedPnl: {
      total: totalPnl(closedLikes),
      avgPnl: avgPnl(closedLikes),
      winRate: winRate(closedLikes),
      wins,
      losses,
      bestTrade: bestTrade(closedLikes),
      worstTrade: worstTrade(closedLikes),
    },
    byAnalyst,
    equityCurve,
  };
}
