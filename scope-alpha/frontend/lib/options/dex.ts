/**
 * Delta Exposure (DEX) aggregation.
 *
 * Mirror of GEX but for dealer delta — net directional hedging pressure
 * implied by the OI-weighted dealer-positioning assumption.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type {
  DEXLevel,
  DEXOutput,
  DirectionalBias,
} from '@/types/options';

const DEALER_CALL_FACTOR = -0.4;
const DEALER_PUT_FACTOR = -0.6;

export function computeDEX(
  asset: string,
  chain: OptionsChainEntry[],
): DEXOutput | null {
  if (chain.length === 0) return null;
  const spotPrice = chain[0].underlyingPrice;
  if (!Number.isFinite(spotPrice) || spotPrice <= 0) return null;

  const dexByStrike = new Map<number, number>();

  for (const opt of chain) {
    const delta = opt.delta;
    if (delta == null || !Number.isFinite(delta)) continue;
    const factor =
      opt.optionType === 'call' ? DEALER_CALL_FACTOR : DEALER_PUT_FACTOR;
    const dealerDelta = factor * delta * opt.openInterest * spotPrice;
    dexByStrike.set(
      opt.strike,
      (dexByStrike.get(opt.strike) ?? 0) + dealerDelta,
    );
  }

  const levels: DEXLevel[] = Array.from(dexByStrike.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([strike, v]) => ({
      strike,
      dex_usd: v,
      direction: v >= 0 ? 'long' : 'short',
    }));

  if (levels.length === 0) return null;

  const netDex = levels.reduce((s, lv) => s + lv.dex_usd, 0);

  // Directional bias as a fraction of total notional — keeps thresholds
  // scale-invariant across BTC and ETH.
  const totalAbs = levels.reduce((s, lv) => s + Math.abs(lv.dex_usd), 0);
  const netRatio = totalAbs > 0 ? netDex / totalAbs : 0;
  let bias: DirectionalBias;
  if (netRatio > 0.3) bias = 'long';
  else if (netRatio > 0.1) bias = 'slightly_long';
  else if (netRatio < -0.3) bias = 'short';
  else if (netRatio < -0.1) bias = 'slightly_short';
  else bias = 'neutral';

  const interpretation =
    bias === 'long'
      ? 'Net dealer delta is long — dealers will sell rallies (bearish hedging pressure).'
      : bias === 'slightly_long'
      ? 'Net dealer delta is slightly long — mild resistance from dealer hedging on rallies.'
      : bias === 'short'
      ? 'Net dealer delta is short — dealers will buy dips (bullish hedging pressure).'
      : bias === 'slightly_short'
      ? 'Net dealer delta is slightly short — dealers will buy on dips (mild bullish hedging pressure).'
      : 'Net dealer delta is near zero — no clear directional hedging pressure.';

  return {
    asset,
    spot_price: spotPrice,
    levels,
    net_dex: netDex,
    directional_bias: bias,
    interpretation,
    computed_at: new Date().toISOString(),
  };
}
