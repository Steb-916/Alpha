/**
 * Max pain calculation.
 *
 * "Max pain" is the strike price at which the total USD value of expiring
 * options (held by option buyers) is minimized. It's a common retail
 * heuristic for where option sellers would prefer spot to close at expiry.
 *
 * Algorithm:
 *   For each candidate strike K_candidate:
 *     pain(K_candidate) = sum over all calls: max(0, K_candidate - K_call) * OI_call
 *                       + sum over all puts:  max(0, K_put - K_candidate) * OI_put
 *   Max-pain = argmin(pain).
 *
 * Candidate strikes are the set of all distinct strikes in the chain for
 * the given expiration.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';

export function computeMaxPain(
  chain: OptionsChainEntry[],
  expirationDate: Date,
): number | null {
  const ts = expirationDate.getTime();
  const atExpiry = chain.filter(
    (c) => c.expirationDate.getTime() === ts,
  );
  if (atExpiry.length === 0) return null;

  const strikes = Array.from(new Set(atExpiry.map((c) => c.strike))).sort(
    (a, b) => a - b,
  );

  let bestStrike = strikes[0];
  let bestPain = Number.POSITIVE_INFINITY;

  for (const k of strikes) {
    let pain = 0;
    for (const c of atExpiry) {
      if (c.optionType === 'call') {
        pain += Math.max(0, k - c.strike) * c.openInterest;
      } else {
        pain += Math.max(0, c.strike - k) * c.openInterest;
      }
    }
    if (pain < bestPain) {
      bestPain = pain;
      bestStrike = k;
    }
  }

  return bestStrike;
}
