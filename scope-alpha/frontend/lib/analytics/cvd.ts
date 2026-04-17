/**
 * Cumulative Volume Delta (CVD) + divergence detection.
 *
 * CVD is a running sum of (takerBuyVolume − takerSellVolume) per candle.
 * A rising CVD means aggressive buyers are dominant; falling CVD means
 * aggressive sellers. Divergences between CVD direction and price direction
 * are the signal.
 *
 * Data source: per-candle takerBuyBaseAssetVolume from Binance klines
 * (populated in `binance.getKlines` via field [9]). We don't subscribe to
 * aggTrade streams — the candle-level fidelity is sufficient for Phase 2.
 */

import type { OHLCV } from '@/lib/exchanges/types';
import { classifySeverity, type Severity } from './math';

export interface CVDPoint {
  timestamp: number; // ms since epoch
  cvd: number;
  price: number;
  takerBuyVol: number;
  takerSellVol: number;
}

export type DivergenceType = 'bullish' | 'bearish';

export interface Divergence {
  type: DivergenceType;
  startTimestamp: number;
  endTimestamp: number;
  priceChange: number; // %
  cvdChange: number; // raw delta
  severity: Severity;
}

/**
 * Build a CVD series from OHLCV candles. Candles missing takerBuyVolume are
 * skipped — the cumulative sum only advances when the data is present.
 */
export function computeCVD(candles: OHLCV[]): CVDPoint[] {
  const out: CVDPoint[] = [];
  let running = 0;
  for (const c of candles) {
    if (c.takerBuyVolume == null) continue;
    const takerBuyVol = c.takerBuyVolume;
    const takerSellVol = Math.max(0, c.volume - takerBuyVol);
    running += takerBuyVol - takerSellVol;
    out.push({
      timestamp: c.time * 1000, // candle `time` is seconds
      cvd: running,
      price: c.close,
      takerBuyVol,
      takerSellVol,
    });
  }
  return out;
}

/**
 * Detect bullish/bearish divergences via sliding window. Bearish: price up,
 * CVD down. Bullish: price down, CVD up. Thresholds are conservative to keep
 * noise low — tune via the priceThreshold / cvdThreshold args.
 */
export function detectDivergences(
  series: CVDPoint[],
  opts: {
    lookback?: number;
    priceThreshold?: number; // minimum fractional price move (0.005 = 0.5%)
    cvdThreshold?: number; // minimum absolute CVD change
  } = {},
): Divergence[] {
  const lookback = opts.lookback ?? 20;
  const priceThreshold = opts.priceThreshold ?? 0.005;
  const cvdThreshold = opts.cvdThreshold ?? 0;

  if (series.length < lookback + 1) return [];

  const divs: Divergence[] = [];
  for (let i = lookback; i < series.length; i++) {
    const a = series[i - lookback];
    const b = series[i];
    if (a.price === 0) continue;

    const priceChange = (b.price - a.price) / a.price;
    const cvdChange = b.cvd - a.cvd;

    // Bearish: price rose but CVD fell
    if (priceChange > priceThreshold && cvdChange < -cvdThreshold) {
      divs.push({
        type: 'bearish',
        startTimestamp: a.timestamp,
        endTimestamp: b.timestamp,
        priceChange: priceChange * 100,
        cvdChange,
        severity: classifySeverity(Math.abs(priceChange), Math.abs(cvdChange)),
      });
    }

    // Bullish: price fell but CVD rose
    if (priceChange < -priceThreshold && cvdChange > cvdThreshold) {
      divs.push({
        type: 'bullish',
        startTimestamp: a.timestamp,
        endTimestamp: b.timestamp,
        priceChange: priceChange * 100,
        cvdChange,
        severity: classifySeverity(Math.abs(priceChange), Math.abs(cvdChange)),
      });
    }
  }

  return mergeOverlappingDivergences(divs);
}

/**
 * Merge consecutive divergences of the same type whose time windows overlap.
 * Keeps the full combined range and the max magnitude severity.
 */
export function mergeOverlappingDivergences(divs: Divergence[]): Divergence[] {
  if (divs.length === 0) return [];

  const sorted = [...divs].sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );

  const severityRank: Record<Severity, number> = {
    mild: 1,
    moderate: 2,
    severe: 3,
  };

  const merged: Divergence[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (
      prev.type === cur.type &&
      cur.startTimestamp <= prev.endTimestamp
    ) {
      prev.endTimestamp = Math.max(prev.endTimestamp, cur.endTimestamp);
      if (Math.abs(cur.priceChange) > Math.abs(prev.priceChange)) {
        prev.priceChange = cur.priceChange;
      }
      if (Math.abs(cur.cvdChange) > Math.abs(prev.cvdChange)) {
        prev.cvdChange = cur.cvdChange;
      }
      if (severityRank[cur.severity] > severityRank[prev.severity]) {
        prev.severity = cur.severity;
      }
    } else {
      merged.push(cur);
    }
  }

  return merged;
}

/**
 * Categorize the short-term CVD direction from the last N points. Used by
 * the screener "cvdTrend" column.
 */
export function cvdTrendLabel(
  series: CVDPoint[],
  window = 24,
): 'bullish' | 'bearish' | 'neutral' {
  if (series.length < 2) return 'neutral';
  const w = Math.min(window, series.length);
  const a = series[series.length - w].cvd;
  const b = series[series.length - 1].cvd;
  const range = Math.max(Math.abs(a), Math.abs(b), 1);
  const rel = (b - a) / range;
  if (rel > 0.05) return 'bullish';
  if (rel < -0.05) return 'bearish';
  return 'neutral';
}
