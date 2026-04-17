import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';

/**
 * Put/Call OI ratio for a given expiration (or the full chain if no expiry
 * is passed). Returns 0 when there's no call OI (to avoid Infinity).
 */
export function computePCR(
  chain: OptionsChainEntry[],
  expirationDate?: Date,
): number {
  const scope = expirationDate
    ? chain.filter(
        (c) => c.expirationDate.getTime() === expirationDate.getTime(),
      )
    : chain;

  let putOI = 0;
  let callOI = 0;
  for (const c of scope) {
    if (c.optionType === 'put') putOI += c.openInterest;
    else callOI += c.openInterest;
  }
  if (callOI === 0) return 0;
  return putOI / callOI;
}
