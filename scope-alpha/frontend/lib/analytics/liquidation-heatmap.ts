/**
 * Liquidation heatmap — Gaussian leverage model.
 *
 * Estimates where leveraged positions would be liquidated based on:
 *   - Current OI (exchange-reported aggregate)
 *   - Long/short account ratio (Binance globalLongShortAccountRatio)
 *   - Typical leverage distribution (discrete buckets with fixed weights)
 *   - Position entries assumed Gaussian around recent price, stddev scaled
 *     by 7-day realized volatility
 *
 * Output is a 40-level heatmap spanning ±10% of current price, with
 * normalized `intensity` in [0, 1] for each level.
 */

import { gaussianPDF } from './math';

export interface HeatmapLevel {
  price: number;
  estimatedLiqVolume: number;
  side: 'long' | 'short';
  intensity: number; // 0..1
}

export interface HeatmapMetadata {
  estimatedLongLeverage: number;
  estimatedShortLeverage: number;
  longShortRatio: number;
  model: string;
  updatedAt: string;
}

export interface HeatmapResult {
  asset: string;
  currentPrice: number;
  levels: HeatmapLevel[];
  metadata: HeatmapMetadata;
}

// Retail-weighted leverage distribution (more mass at 2-10x, tail at high leverage)
const LEVERAGE_BUCKETS = [2, 3, 5, 10, 20, 50, 100];
const LEVERAGE_WEIGHTS = [0.12, 0.22, 0.28, 0.20, 0.10, 0.05, 0.03]; // sums to 1.0

const LEVEL_COUNT = 60; // 30 below + 30 above current price
const RANGE_FRACTION = 0.15; // ±15% price range — captures secondary cascades

export interface HeatmapInputs {
  asset: string;
  currentPrice: number;
  /** Aggregate OI in USD (or contracts — units cancel out in intensity). */
  totalOI: number;
  /** Ratio of long-account share to short-account share. Falls back to 1.0. */
  longShortRatio: number;
  /** 7-day realized vol as a fraction (e.g., 0.05 = 5%). Falls back to 0.04. */
  realizedVol: number;
}

export function computeLiquidationHeatmap(
  inputs: HeatmapInputs,
): HeatmapResult {
  const { asset, currentPrice, totalOI } = inputs;
  const longShortRatio =
    Number.isFinite(inputs.longShortRatio) && inputs.longShortRatio > 0
      ? inputs.longShortRatio
      : 1;
  const realizedVol =
    Number.isFinite(inputs.realizedVol) && inputs.realizedVol > 0
      ? inputs.realizedVol
      : 0.04;

  const priceSigma = currentPrice * realizedVol;
  const priceRange = currentPrice * RANGE_FRACTION;
  const stepSize = priceRange / (LEVEL_COUNT / 2);

  const longOI = totalOI * (longShortRatio / (1 + longShortRatio));
  const shortOI = totalOI * (1 / (1 + longShortRatio));

  const levels: HeatmapLevel[] = [];

  for (let offset = -LEVEL_COUNT / 2; offset <= LEVEL_COUNT / 2; offset++) {
    const priceLevel = currentPrice + offset * stepSize;
    if (priceLevel <= 0) continue;

    let estimatedVolume = 0;

    for (let i = 0; i < LEVERAGE_BUCKETS.length; i++) {
      const lev = LEVERAGE_BUCKETS[i];
      const weight = LEVERAGE_WEIGHTS[i];

      // Entry prices that would produce a liquidation at priceLevel.
      // Long gets liquidated when mark drops: entry = priceLevel / (1 - 1/L)
      // Short gets liquidated when mark rises: entry = priceLevel / (1 + 1/L)
      const longEntry = priceLevel / (1 - 1 / lev);
      const shortEntry = priceLevel / (1 + 1 / lev);

      // Gaussian probability density that a position exists at that entry.
      const longProb = gaussianPDF(longEntry, currentPrice, priceSigma);
      const shortProb = gaussianPDF(shortEntry, currentPrice, priceSigma);

      estimatedVolume +=
        longProb * longOI * weight + shortProb * shortOI * weight;
    }

    levels.push({
      price: priceLevel,
      estimatedLiqVolume: estimatedVolume,
      side: priceLevel < currentPrice ? 'long' : 'short',
      intensity: 0, // filled below
    });
  }

  // Normalize intensity to 0..1
  const maxVol = Math.max(...levels.map((l) => l.estimatedLiqVolume), 1e-9);
  for (const l of levels) {
    l.intensity = l.estimatedLiqVolume / maxVol;
  }

  // Weighted-average leverage estimates per side (sanity-check metadata)
  const estimatedLongLeverage = LEVERAGE_BUCKETS.reduce(
    (s, lev, i) => s + lev * LEVERAGE_WEIGHTS[i],
    0,
  );
  const estimatedShortLeverage = estimatedLongLeverage;

  return {
    asset,
    currentPrice,
    levels,
    metadata: {
      estimatedLongLeverage,
      estimatedShortLeverage,
      longShortRatio,
      model: 'gaussian_leverage_v2',
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Compute realized 7-day volatility from daily candle closes.
 * sigma = stddev(log returns) × √7 (scales daily to weekly).
 */
export function computeRealized7dVol(dailyCloses: number[]): number {
  if (dailyCloses.length < 3) return 0.04; // fallback
  const returns: number[] = [];
  for (let i = 1; i < dailyCloses.length; i++) {
    const prev = dailyCloses[i - 1];
    const curr = dailyCloses[i];
    if (prev > 0 && curr > 0) returns.push(Math.log(curr / prev));
  }
  if (returns.length < 2) return 0.04;
  const m = returns.reduce((s, x) => s + x, 0) / returns.length;
  let v = 0;
  for (const r of returns) v += (r - m) ** 2;
  const sd = Math.sqrt(v / (returns.length - 1));
  return sd * Math.sqrt(7);
}
