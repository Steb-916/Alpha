/**
 * Regime classification helpers.
 *
 * The v2 classifier converts a numerical health score (0-100) to a 7-band
 * regime label with color + description. The trend classifier converts a
 * change24h delta into a direction label + a momentum tag that compares
 * change24h to change7d.
 */

import {
  REGIME_V2_BANDS,
  TREND_BANDS,
  type RegimeBand,
  type RegimeV2,
  type TrendDirection,
  type TrendMomentum,
} from '@/config/healthScore';

export interface ClassifiedRegime {
  label: RegimeV2;
  color: string;
  description: string;
}

/**
 * Map a composite health score (0-100) to a regime band.
 */
export function classifyRegime(score: number): ClassifiedRegime {
  const clamped = Math.max(0, Math.min(100, score));
  const band: RegimeBand =
    REGIME_V2_BANDS.find((b) => clamped < b.max) ??
    REGIME_V2_BANDS[REGIME_V2_BANDS.length - 1];
  return {
    label: band.label,
    color: band.color,
    description: band.description,
  };
}

export interface ClassifiedTrend {
  direction: TrendDirection;
  momentum: TrendMomentum;
}

/**
 * Classify trend direction from 24h delta and momentum by comparing 24h vs 7d.
 *
 * momentum:
 *   - accelerating: the 24h rate of change is faster than the 7d rate
 *   - decelerating: the 24h rate is slower than the 7d rate
 *   - steady:       within a small tolerance of the 7d rate
 */
export function classifyTrend(
  change24h: number,
  change7d: number,
): ClassifiedTrend {
  const direction: TrendDirection =
    TREND_BANDS.find((b) => change24h >= b.min)?.label ??
    'rapidly_deteriorating';

  // Normalize 7d to a 24h-equivalent rate so comparison is apples-to-apples.
  const change7dPerDay = change7d / 7;
  const diff = change24h - change7dPerDay;
  let momentum: TrendMomentum;
  if (Math.abs(diff) < 2) momentum = 'steady';
  else if (diff > 0) momentum = 'accelerating';
  else momentum = 'decelerating';

  return { direction, momentum };
}

/**
 * Map a regime label back to its color (for UI components that only have
 * the label string).
 */
export function regimeColor(label: RegimeV2 | string | null | undefined): string {
  if (!label) return '#9ca3af';
  const band = REGIME_V2_BANDS.find((b) => b.label === label);
  return band?.color ?? '#9ca3af';
}
