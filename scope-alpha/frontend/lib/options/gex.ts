/**
 * Gamma Exposure (GEX) aggregation.
 *
 * Computes aggregate dealer gamma exposure by strike using the OI-weighted
 * heuristic documented in the Phase 4 PRD §1. Dealers assumed net short
 * ~40% of call OI and ~60% of put OI (a simplified crypto-appropriate
 * assumption — a taker-flow reconstruction would be more precise but needs
 * per-trade data we don't yet persist).
 *
 * All-TypeScript: Deribit's book summary already provides per-instrument
 * gamma, so we aggregate rather than re-derive Black-Scholes Greeks.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type {
  GEXLevel,
  GEXOutput,
  GammaRegime,
} from '@/types/options';

const DEALER_CALL_FACTOR = -0.4;
const DEALER_PUT_FACTOR = -0.6;
/** Strikes within this fraction of spot contribute to the "spot area" regime reading. */
const SPOT_BAND_PCT = 0.02;

export function computeGEX(
  asset: string,
  chain: OptionsChainEntry[],
): GEXOutput | null {
  if (chain.length === 0) return null;
  const spotPrice = chain[0].underlyingPrice;
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) return null;

  const gexByStrike = new Map<number, number>();

  for (const opt of chain) {
    const gamma = opt.gamma;
    if (gamma == null || !Number.isFinite(gamma)) continue;
    const factor =
      opt.optionType === 'call' ? DEALER_CALL_FACTOR : DEALER_PUT_FACTOR;
    // Notional dollar gamma: gamma * OI * contract_size * spot
    // Deribit BTC/ETH options = 1 unit per contract.
    const dealerGamma = factor * gamma * opt.openInterest * spotPrice;
    gexByStrike.set(opt.strike, (gexByStrike.get(opt.strike) ?? 0) + dealerGamma);
  }

  const strikes = Array.from(gexByStrike.keys()).sort((a, b) => a - b);
  if (strikes.length === 0) return null;

  const levels: GEXLevel[] = strikes.map((k) => {
    const v = gexByStrike.get(k) ?? 0;
    return {
      strike: k,
      gex_usd: v,
      side: v >= 0 ? 'positive' : 'negative',
    };
  });

  // Gamma flip: the strike where the running cumulative GEX first crosses
  // zero. Computing cumulatively-from-below-spot mirrors the industry
  // convention: start with strikes below spot accumulating their dealer
  // gamma, find the level where the running sum flips sign.
  const cum: number[] = [];
  let running = 0;
  for (const k of strikes) {
    running += gexByStrike.get(k) ?? 0;
    cum.push(running);
  }
  let gammaFlip = spotPrice;
  for (let i = 1; i < cum.length; i++) {
    if (cum[i - 1] * cum[i] < 0) {
      // Linear-interp the zero crossing between strikes[i-1] and strikes[i]
      const x0 = strikes[i - 1];
      const x1 = strikes[i];
      const y0 = cum[i - 1];
      const y1 = cum[i];
      gammaFlip = x0 + (x1 - x0) * (0 - y0) / (y1 - y0 || 1);
      break;
    }
  }

  // Walls: largest positive GEX above spot = call wall;
  //        most-negative GEX below spot = put wall.
  let callWall = spotPrice;
  let callWallGex = 0;
  let putWall = spotPrice;
  let putWallGex = 0;
  for (const lv of levels) {
    if (lv.strike >= spotPrice && lv.gex_usd > callWallGex) {
      callWallGex = lv.gex_usd;
      callWall = lv.strike;
    }
    if (lv.strike <= spotPrice && lv.gex_usd < putWallGex) {
      putWallGex = lv.gex_usd;
      putWall = lv.strike;
    }
  }

  // Regime — sign of GEX summed across strikes near spot.
  const band = spotPrice * SPOT_BAND_PCT;
  const spotAreaGex = levels
    .filter((lv) => Math.abs(lv.strike - spotPrice) <= band)
    .reduce((s, lv) => s + lv.gex_usd, 0);
  const regime: GammaRegime =
    spotAreaGex >= 0 ? 'positive_gamma' : 'negative_gamma';

  const totalGex = levels.reduce((s, lv) => s + lv.gex_usd, 0);

  const regimeDescription =
    regime === 'positive_gamma'
      ? 'Dealers are net long gamma near spot. Expect dampened moves, mean-reversion, and lower realized volatility.'
      : 'Dealers are net short gamma near spot. Expect amplified moves and higher realized volatility; breakouts likely to extend.';

  const callWallLabel = callWall.toLocaleString();
  const putWallLabel = putWall.toLocaleString();
  const flipLabel = gammaFlip.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  const interpretation = {
    above_spot:
      callWallGex > 0
        ? `Positive gamma cluster at $${callWallLabel} creates resistance — rallies face dealer selling pressure.`
        : `Limited positive-gamma above spot — upside path of least resistance.`,
    below_spot:
      putWallGex < 0
        ? `Negative gamma below $${flipLabel} (gamma flip) — a break below this level could accelerate downside as dealers amplify the move.`
        : `Limited negative-gamma below spot — downside support from dealer positioning.`,
    regime_implications:
      regime === 'positive_gamma'
        ? 'Current positive-gamma regime favors range-bound strategies. Breakouts unlikely to stick unless the gamma flip is breached.'
        : 'Current negative-gamma regime favors trend-following. Breakouts likely to extend due to dealer hedging pressure.',
  };

  return {
    asset,
    spot_price: spotPrice,
    levels,
    gamma_flip: gammaFlip,
    total_gex: totalGex,
    regime,
    regime_description: regimeDescription,
    call_wall: callWall,
    put_wall: putWall,
    interpretation,
    computed_at: new Date().toISOString(),
  };
}
