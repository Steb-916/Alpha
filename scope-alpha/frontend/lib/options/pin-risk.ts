/**
 * Max Pain and Pin Risk computation.
 *
 * Extends the existing max-pain calculation with a pin risk score that
 * estimates how likely price is to cluster near a high-OI strike at expiry.
 *
 * Pin risk score formula:
 *   score = 100 × exp(−|spotDistPct| / 5) × exp(−daysToExpiry / 14)
 *
 * This decays exponentially with spot distance and time to expiry:
 *   - A strike 0% away with 0 DTE → score 100
 *   - A strike 5% away with 14 DTE → score ≈ 13.5
 *   - A strike 10% away with 30 DTE → score ≈ 1
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type { MaxPainPinRisk, MaxPainExpiration } from '@/types/options';
import { computeMaxPain } from './max-pain';

function computePinRiskScore(
  spotDistancePct: number | null,
  daysToExpiry: number,
): number {
  if (spotDistancePct === null) return 0;
  const distFactor = Math.exp(-Math.abs(spotDistancePct) / 5);
  const timeFactor = Math.exp(-daysToExpiry / 14);
  return Math.min(100, Math.round(100 * distFactor * timeFactor));
}

export function computeMaxPainPinRisk(chain: OptionsChainEntry[]): MaxPainPinRisk {
  const now = new Date().toISOString();
  const spot = chain[0]?.underlyingPrice ?? 0;
  const asset = chain[0]?.asset ?? '';

  // Group instruments by expiration date
  const expirationMap = new Map<
    string,
    { date: Date; daysToExpiry: number; instruments: OptionsChainEntry[] }
  >();

  for (const c of chain) {
    const key = c.expirationDate.toISOString().slice(0, 10);
    const existing = expirationMap.get(key);
    if (existing) {
      existing.instruments.push(c);
    } else {
      expirationMap.set(key, {
        date: c.expirationDate,
        daysToExpiry: c.daysToExpiry,
        instruments: [c],
      });
    }
  }

  const expirations: MaxPainExpiration[] = [];

  for (const [expiration, { date, daysToExpiry, instruments }] of expirationMap) {
    if (daysToExpiry < 0) continue;

    // Max pain via existing utility
    const maxPain = computeMaxPain(instruments, date);

    // Highest OI strike (combined calls + puts)
    const oiByStrike = new Map<number, number>();
    for (const c of instruments) {
      oiByStrike.set(c.strike, (oiByStrike.get(c.strike) ?? 0) + c.openInterest);
    }
    let highestOiStrike: number | null = null;
    let highestOiValue = 0;
    for (const [strike, oi] of oiByStrike) {
      if (oi > highestOiValue) {
        highestOiValue = oi;
        highestOiStrike = strike;
      }
    }

    const spotDistancePct =
      maxPain !== null && spot > 0
        ? ((spot - maxPain) / spot) * 100
        : null;

    const pinRiskScore = computePinRiskScore(spotDistancePct, daysToExpiry);

    expirations.push({
      expiration,
      daysToExpiry,
      maxPain,
      highestOiStrike,
      highestOiValue,
      spotDistancePct,
      pinRiskScore,
    });
  }

  // Sort by DTE ascending
  expirations.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  return { asset, timestamp: now, spot, expirations };
}
