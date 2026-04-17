/**
 * Vanna + charm aggregate exposure.
 *
 * Vanna = dDelta/dIV. Positive-vanna strikes mean a drop in IV forces
 * dealers to buy underlying (bullish flow on vol compression); negative-
 * vanna strikes mean the opposite.
 *
 * Charm = -dDelta/dTime. Explains the "pin drift" into expiry — as time
 * decays, delta shifts and dealers re-hedge directionally.
 *
 * Deribit doesn't provide vanna/charm directly, so we approximate from
 * the Greeks it does return (delta, gamma, vega, theta). The
 * approximations are documented in the PRD §3.3 and are first-order
 * proxies — precision is not the goal here; relative strike-by-strike
 * positioning is.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type {
  CharmLevel,
  GreeksExposureOutput,
  VannaLevel,
} from '@/types/options';

const DEALER_CALL_FACTOR = -0.4;
const DEALER_PUT_FACTOR = -0.6;

/** |delta| floor to avoid divide-by-zero in the charm approximation. */
const MIN_ABS_DELTA = 0.001;

export function computeVannaCharm(
  asset: string,
  chain: OptionsChainEntry[],
): GreeksExposureOutput | null {
  if (chain.length === 0) return null;
  const spotPrice = chain[0].underlyingPrice;
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) return null;

  const vannaByStrike = new Map<number, number>();
  const charmByStrike = new Map<number, number>();

  for (const opt of chain) {
    const { delta, vega, theta, gamma } = opt;
    if (delta == null || !Number.isFinite(delta)) continue;

    const factor =
      opt.optionType === 'call' ? DEALER_CALL_FACTOR : DEALER_PUT_FACTOR;

    // Vanna approximation: vega * delta / spot
    const vannaEst =
      vega != null && Number.isFinite(vega) ? (vega * delta) / spotPrice : 0;

    // Charm approximation: -theta * gamma / |delta|
    const charmEst =
      theta != null &&
      Number.isFinite(theta) &&
      gamma != null &&
      Number.isFinite(gamma)
        ? (-theta * gamma) / Math.max(Math.abs(delta), MIN_ABS_DELTA)
        : 0;

    vannaByStrike.set(
      opt.strike,
      (vannaByStrike.get(opt.strike) ?? 0) +
        factor * vannaEst * opt.openInterest,
    );
    charmByStrike.set(
      opt.strike,
      (charmByStrike.get(opt.strike) ?? 0) +
        factor * charmEst * opt.openInterest,
    );
  }

  const vannaLevels: VannaLevel[] = Array.from(vannaByStrike.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([strike, v]) => ({
      strike,
      vanna_exposure: v,
      iv_sensitivity: v >= 0 ? 'positive' : 'negative',
    }));
  const charmLevels: CharmLevel[] = Array.from(charmByStrike.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([strike, v]) => ({ strike, charm_exposure: v }));

  if (vannaLevels.length === 0 && charmLevels.length === 0) return null;

  const netVanna = vannaLevels.reduce((s, l) => s + l.vanna_exposure, 0);
  const netCharm = charmLevels.reduce((s, l) => s + l.charm_exposure, 0);

  const vannaInterpretation =
    netVanna > 0
      ? 'Net positive vanna — if IV drops (post-event), dealers will buy the underlying to re-hedge. Bullish flow on vol compression.'
      : netVanna < 0
      ? 'Net negative vanna — if IV drops, dealers will sell the underlying. Bearish flow on vol compression.'
      : 'Net vanna near zero — dealer positioning is neutral to IV changes.';

  const timeDecayBias: 'bullish' | 'bearish' | 'neutral' =
    netCharm > 0 ? 'bullish' : netCharm < 0 ? 'bearish' : 'neutral';

  const charmInterpretation =
    timeDecayBias === 'bullish'
      ? 'Positive charm — time decay is pushing dealer delta higher, creating buying pressure into expiry.'
      : timeDecayBias === 'bearish'
      ? 'Negative charm — time decay is pushing dealer delta lower, creating selling pressure into expiry.'
      : 'Neutral charm — time decay has minimal directional impact on dealer positioning.';

  return {
    asset,
    spot_price: spotPrice,
    vanna: {
      levels: vannaLevels,
      net_vanna: netVanna,
      interpretation: vannaInterpretation,
    },
    charm: {
      levels: charmLevels,
      net_charm: netCharm,
      time_decay_bias: timeDecayBias,
      interpretation: charmInterpretation,
    },
    computed_at: new Date().toISOString(),
  };
}
