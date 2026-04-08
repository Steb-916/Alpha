/**
 * Drawdown calculation.
 *
 * Builds a cumulative P&L equity curve from resolved signals (sorted by
 * resolvedAt ASC), tracks the running peak, and reports the max + current
 * drawdown as well as a per-point series for charting.
 *
 * The drawdown formula uses `peak - 1` (with a +1 offset) instead of bare
 * `peak` to avoid div-by-zero on the very first signal — equity starts at
 * 0% and the first drawdown is therefore expressed as additive percentage
 * points below peak rather than a relative ratio.
 */

import type { SignalLike } from './metrics';
import { isResolved } from './metrics';

export interface DrawdownPoint {
  date: string;
  cumulative: number;
  peak: number;
  drawdownPct: number;
}

export interface DrawdownResult {
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  maxDrawdownStartDate: Date | null;
  maxDrawdownEndDate: Date | null;
  drawdownSeries: DrawdownPoint[];
}

const EMPTY: DrawdownResult = {
  maxDrawdownPct: 0,
  currentDrawdownPct: 0,
  maxDrawdownStartDate: null,
  maxDrawdownEndDate: null,
  drawdownSeries: [],
};

export function calculateDrawdown(signals: SignalLike[]): DrawdownResult {
  const resolved = signals.filter(isResolved).filter((s) => s.resolvedAt);
  if (resolved.length === 0) return EMPTY;

  // Sort ASC by resolvedAt.
  const sorted = [...resolved].sort((a, b) => {
    const at = new Date(a.resolvedAt as string | Date).getTime();
    const bt = new Date(b.resolvedAt as string | Date).getTime();
    return at - bt;
  });

  let cumulative = 0;
  let peak = 0;
  let peakDate: Date | null = null;
  let maxDrawdownPct = 0;
  let maxDrawdownStartDate: Date | null = null;
  let maxDrawdownEndDate: Date | null = null;

  const series: DrawdownPoint[] = [];

  for (const s of sorted) {
    cumulative += s.resultPnlPercent ?? 0;
    const date = new Date(s.resolvedAt as string | Date);

    if (cumulative > peak) {
      peak = cumulative;
      peakDate = date;
    }

    // Drawdown expressed as additive percentage points below peak.
    // For an equity curve starting at 0%, this is the cleanest measure.
    const drawdownPct = cumulative - peak;

    if (drawdownPct < maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
      maxDrawdownStartDate = peakDate;
      maxDrawdownEndDate = date;
    }

    series.push({
      date: date.toISOString(),
      cumulative: Math.round(cumulative * 10000) / 10000,
      peak: Math.round(peak * 10000) / 10000,
      drawdownPct: Math.round(drawdownPct * 10000) / 10000,
    });
  }

  // currentDrawdownPct = the drawdown of the most recent point.
  const currentDrawdownPct = series[series.length - 1]?.drawdownPct ?? 0;

  return {
    maxDrawdownPct: Math.round(maxDrawdownPct * 10000) / 10000,
    currentDrawdownPct,
    maxDrawdownStartDate,
    maxDrawdownEndDate,
    drawdownSeries: series,
  };
}
