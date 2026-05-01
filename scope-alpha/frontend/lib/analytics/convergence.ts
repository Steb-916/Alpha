/**
 * 3-domain convergence scoring.
 * Combines derivatives (health score), on-chain, and options (RND skewness)
 * signals to detect when multiple domains agree on direction.
 *
 * High convergence + clear direction = stronger signal.
 * Low convergence = conflicting domains = caution.
 */

import type { OnChainOverview, ExchangeFlowData } from '@/lib/onchain/types';

export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

export interface DomainSignal {
  signal: SignalDirection;
  weight: number;
  reason: string;
}

export interface ConvergenceScore {
  score: number;
  direction: 'bullish' | 'bearish' | 'mixed';
  confidence: 'high' | 'medium' | 'low';
  components: {
    derivatives: DomainSignal;
    onchain: DomainSignal;
    options: DomainSignal;
  };
  agreementCount: number;
  activeDomains: number;
  description: string;
}

function derivativesSignal(healthScore: number): DomainSignal {
  if (healthScore >= 65) {
    return { signal: 'bullish', weight: 1, reason: `Health score ${healthScore} — positive derivatives conditions` };
  }
  if (healthScore <= 35) {
    return { signal: 'bearish', weight: 1, reason: `Health score ${healthScore} — elevated risk conditions` };
  }
  return { signal: 'neutral', weight: 1, reason: `Health score ${healthScore} — mixed derivatives signals` };
}

function onchainSignal(
  onchain: OnChainOverview | null,
  flows: ExchangeFlowData | null,
): DomainSignal {
  if (!onchain) {
    return { signal: 'neutral', weight: 0, reason: 'On-chain data unavailable' };
  }

  const mvrv = onchain.mvrvZScore;
  const sopr = onchain.sopr;
  const flowTrend = flows?.summary?.trend ?? null;

  let bullishCount = 0;
  let bearishCount = 0;
  const reasons: string[] = [];

  if (mvrv !== null) {
    if (mvrv < 0) { bullishCount++; reasons.push(`MVRV Z=${mvrv.toFixed(2)} (undervalued)`); }
    else if (mvrv > 2) { bearishCount++; reasons.push(`MVRV Z=${mvrv.toFixed(2)} (overvalued)`); }
  }
  if (sopr !== null) {
    if (sopr < 0.98) { bullishCount++; reasons.push(`SOPR=${sopr.toFixed(3)} (capitulation)`); }
    else if (sopr > 1.05) { bearishCount++; reasons.push(`SOPR=${sopr.toFixed(3)} (distribution)`); }
  }
  if (flowTrend === 'accumulation') { bullishCount++; reasons.push('Exchange outflows (accumulation)'); }
  else if (flowTrend === 'distribution') { bearishCount++; reasons.push('Exchange inflows (distribution)'); }

  const total = bullishCount + bearishCount;
  if (total === 0) return { signal: 'neutral', weight: 1, reason: 'All on-chain metrics neutral' };

  if (bullishCount > bearishCount) {
    return { signal: 'bullish', weight: 1, reason: reasons.join(', ') };
  }
  if (bearishCount > bullishCount) {
    return { signal: 'bearish', weight: 1, reason: reasons.join(', ') };
  }
  return { signal: 'neutral', weight: 1, reason: 'Mixed on-chain signals' };
}

function optionsSignal(rndSkewness: number | null | undefined): DomainSignal {
  if (rndSkewness === null || rndSkewness === undefined) {
    return { signal: 'neutral', weight: 0, reason: 'Options data unavailable' };
  }
  if (rndSkewness > 0.3) {
    return { signal: 'bullish', weight: 1, reason: `RND skew=${rndSkewness.toFixed(2)} (positive — market pricing upside)` };
  }
  if (rndSkewness < -0.3) {
    return { signal: 'bearish', weight: 1, reason: `RND skew=${rndSkewness.toFixed(2)} (negative — market pricing downside)` };
  }
  return { signal: 'neutral', weight: 1, reason: `RND skew=${rndSkewness.toFixed(2)} (near symmetric)` };
}

export function computeConvergence(args: {
  healthScore: number;
  onchain: OnChainOverview | null;
  flows?: ExchangeFlowData | null;
  rndSkewness?: number | null;
}): ConvergenceScore {
  const deriv = derivativesSignal(args.healthScore);
  const chain = onchainSignal(args.onchain, args.flows ?? null);
  const opts = optionsSignal(args.rndSkewness);

  const activeDomains = [deriv, chain, opts].filter((d) => d.weight > 0).length;
  const activeSignals = [deriv, chain, opts].filter((d) => d.weight > 0);

  const bullish = activeSignals.filter((d) => d.signal === 'bullish').length;
  const bearish = activeSignals.filter((d) => d.signal === 'bearish').length;
  const dominant = bullish >= bearish ? bullish : bearish;
  const agreementCount = dominant;

  // Score: 100 = all domains agree, 0 = max disagreement
  const score = activeDomains > 0 ? Math.round((agreementCount / activeDomains) * 100) : 50;

  const direction: ConvergenceScore['direction'] =
    bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'mixed';

  const confidence: ConvergenceScore['confidence'] =
    activeDomains >= 3 && agreementCount >= 3 ? 'high' :
    activeDomains >= 2 && agreementCount >= 2 ? 'medium' : 'low';

  const description =
    activeDomains < 2
      ? 'Insufficient data for multi-domain convergence'
      : agreementCount === activeDomains
      ? `All ${activeDomains} domains agree: ${direction}`
      : `${agreementCount}/${activeDomains} domains lean ${direction === 'mixed' ? 'in mixed directions' : direction}`;

  return {
    score,
    direction,
    confidence,
    components: { derivatives: deriv, onchain: chain, options: opts },
    agreementCount,
    activeDomains,
    description,
  };
}
