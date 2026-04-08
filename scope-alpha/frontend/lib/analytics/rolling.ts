/**
 * Rolling-window performance metrics.
 *
 * Computes 7d / 30d / 90d / all-time stats and a comparison delta vs the
 * preceding period of equal length. Used by /performance/rolling.
 */

import {
  avgPnl,
  isResolved,
  profitFactor,
  sharpeApprox,
  totalPnl,
  winRate,
  type SignalLike,
} from './metrics';
import { calculateDrawdown } from './drawdown';

export interface WindowMetrics {
  totalSignals: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeApprox: number;
}

export interface ComparisonMetric {
  winRateDelta: number;
  pnlDelta: number;
}

export interface RollingPerformance {
  windows: {
    '7d': WindowMetrics;
    '30d': WindowMetrics;
    '90d': WindowMetrics;
    all: WindowMetrics;
  };
  comparison: {
    '7d_vs_prev': ComparisonMetric;
    '30d_vs_prev': ComparisonMetric;
    '90d_vs_prev': ComparisonMetric;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function inWindow(s: SignalLike, from: number, to: number): boolean {
  if (!s.resolvedAt) return false;
  const t = new Date(s.resolvedAt).getTime();
  return t >= from && t < to;
}

function metricsFor(signals: SignalLike[]): WindowMetrics {
  const resolved = signals.filter(isResolved);
  return {
    totalSignals: resolved.length,
    wins: resolved.filter((s) => (s.resultPnlPercent ?? 0) > 0).length,
    winRate: winRate(resolved),
    totalPnl: totalPnl(resolved),
    avgPnl: avgPnl(resolved),
    profitFactor: profitFactor(resolved),
    maxDrawdownPct: calculateDrawdown(resolved).maxDrawdownPct,
    sharpeApprox: sharpeApprox(resolved),
  };
}

export function rollingWindowMetrics(signals: SignalLike[]): RollingPerformance {
  const now = Date.now();
  const windowSpec = [
    { key: '7d', days: 7 },
    { key: '30d', days: 30 },
    { key: '90d', days: 90 },
  ] as const;

  const allResolved = signals.filter(isResolved);
  const allMetrics = metricsFor(allResolved);

  const windows = { all: allMetrics } as RollingPerformance['windows'];
  const comparison = {} as RollingPerformance['comparison'];

  for (const w of windowSpec) {
    const span = w.days * DAY_MS;
    const cur = allResolved.filter((s) => inWindow(s, now - span, now));
    const prev = allResolved.filter((s) => inWindow(s, now - 2 * span, now - span));
    const curMetrics = metricsFor(cur);
    const prevMetrics = metricsFor(prev);
    windows[w.key] = curMetrics;
    comparison[`${w.key}_vs_prev` as keyof RollingPerformance['comparison']] = {
      winRateDelta: round4(curMetrics.winRate - prevMetrics.winRate),
      pnlDelta: round4(curMetrics.totalPnl - prevMetrics.totalPnl),
    };
  }

  return { windows, comparison };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
