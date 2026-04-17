/**
 * Aggregate options chain → per-expiry summary rows.
 *
 * One `ExpirationSummary` per distinct expiration in the chain with:
 *   - counts of calls/puts
 *   - total OI
 *   - total 24h volume
 *   - put/call OI ratio
 *   - max-pain strike
 *   - nearest-the-money IV (ATM proxy) for quick preview
 *
 * Consumed by the /chain API route and the Overview dashboard.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import { computeMaxPain } from './max-pain';
import { computePCR } from './put-call-ratio';

export interface ExpirationSummary {
  expiration: string; // ISO date string (UTC midnight)
  daysToExpiry: number;
  callCount: number;
  putCount: number;
  totalOI: number;
  totalVolume24h: number;
  putCallRatio: number;
  maxPainStrike: number | null;
  atmIV: number | null; // IV of the strike nearest spot
}

export interface ChainAggregate {
  asset: string;
  spotPrice: number;
  expirations: ExpirationSummary[];
  totalInstruments: number;
  updatedAt: string;
}

export function aggregateChain(
  asset: string,
  chain: OptionsChainEntry[],
): ChainAggregate {
  const spotPrice = chain[0]?.underlyingPrice ?? 0;
  const byExpiry = new Map<number, OptionsChainEntry[]>();
  for (const c of chain) {
    const key = c.expirationDate.getTime();
    const arr = byExpiry.get(key) ?? [];
    arr.push(c);
    byExpiry.set(key, arr);
  }

  const expirations: ExpirationSummary[] = [];
  for (const [ts, entries] of byExpiry.entries()) {
    const expirationDate = new Date(ts);
    let callCount = 0;
    let putCount = 0;
    let totalOI = 0;
    let totalVolume24h = 0;
    let nearestStrike = Number.POSITIVE_INFINITY;
    let nearestIV: number | null = null;

    for (const e of entries) {
      if (e.optionType === 'call') callCount++;
      else putCount++;
      totalOI += e.openInterest;
      totalVolume24h += e.volume24h;

      const distance = Math.abs(e.strike - spotPrice);
      if (distance < nearestStrike) {
        nearestStrike = distance;
        nearestIV = e.markIV;
      }
    }

    expirations.push({
      expiration: expirationDate.toISOString(),
      daysToExpiry: entries[0]?.daysToExpiry ?? 0,
      callCount,
      putCount,
      totalOI,
      totalVolume24h,
      putCallRatio: computePCR(chain, expirationDate),
      maxPainStrike: computeMaxPain(chain, expirationDate),
      atmIV: nearestIV,
    });
  }

  expirations.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  return {
    asset,
    spotPrice,
    expirations,
    totalInstruments: chain.length,
    updatedAt: new Date().toISOString(),
  };
}
