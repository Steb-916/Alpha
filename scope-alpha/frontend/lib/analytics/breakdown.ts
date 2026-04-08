/**
 * Per-group performance breakdown.
 *
 * Groups signals by asset, timeframe, or direction and computes the same
 * metrics (winRate, avgPnl, totalPnl, etc.) the dashboard already shows
 * in aggregate. Used by /api/analysts/[slug]/performance/breakdown.
 */

import {
  avgPnl,
  bestTrade,
  isLoss,
  isResolved,
  isWin,
  profitFactor,
  totalPnl,
  winRate,
  worstTrade,
  type SignalLike,
} from './metrics';

export type GroupBy = 'asset' | 'timeframe' | 'direction';

export interface BreakdownRow {
  group: string;
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

function getGroupKey(s: SignalLike, by: GroupBy): string {
  if (by === 'asset') return s.assetSymbol ?? '—';
  if (by === 'timeframe') return s.timeframe ?? '—';
  return s.direction ?? '—';
}

export function breakdownBy(
  signals: SignalLike[],
  by: GroupBy,
): BreakdownRow[] {
  // Only consider resolved signals — unresolved have no contribution to
  // win/loss / pnl.
  const resolved = signals.filter(isResolved);

  const buckets = new Map<string, SignalLike[]>();
  for (const s of resolved) {
    const key = getGroupKey(s, by);
    const arr = buckets.get(key);
    if (arr) arr.push(s);
    else buckets.set(key, [s]);
  }

  const rows: BreakdownRow[] = [];
  for (const [group, list] of buckets.entries()) {
    rows.push({
      group,
      totalSignals: list.length,
      wins: list.filter(isWin).length,
      losses: list.filter(isLoss).length,
      winRate: winRate(list),
      avgPnl: avgPnl(list),
      totalPnl: totalPnl(list),
      profitFactor: profitFactor(list),
      bestTrade: bestTrade(list),
      worstTrade: worstTrade(list),
    });
  }

  // Sort by totalPnl descending so the strongest groups float to the top.
  rows.sort((a, b) => b.totalPnl - a.totalPnl);
  return rows;
}
