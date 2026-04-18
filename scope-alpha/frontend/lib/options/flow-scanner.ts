/**
 * Options flow scanner — detects unusual activity by comparing volume
 * between consecutive hourly chain snapshots.
 *
 * Strategy: instruments with a volume spike between the current and previous
 * chain snapshot are flagged as unusual. This is a proxy for large block
 * trades or unusual accumulation within the polling window.
 *
 * Limitations (documented in UI):
 *   - Only detects hourly volume deltas, not intra-hour flow.
 *   - Cannot distinguish between one large trade and many small ones.
 *   - Flow direction (buy/sell) is unknown from book summary data.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type { OptionsFlow, OptionsFlowEvent } from '@/types/options';

const UNUSUAL_SCORE_MULTIPLIER = 50;

export function computeFlowFromChainDelta(
  current: OptionsChainEntry[],
  previous: OptionsChainEntry[],
): OptionsFlow {
  const now = new Date().toISOString();
  const asset = current[0]?.asset ?? '';

  // Build a lookup map from the previous snapshot
  const prevMap = new Map<string, OptionsChainEntry>();
  for (const c of previous) {
    prevMap.set(c.instrumentName, c);
  }

  // Compute average volume across the current chain for baseline
  const volumes = current.map((c) => c.volume24h).filter((v) => v > 0);
  const avgVolume =
    volumes.length > 0
      ? volumes.reduce((s, v) => s + v, 0) / volumes.length
      : 1;

  const events: OptionsFlowEvent[] = [];
  let netCallPremium = 0;
  let netPutPremium = 0;

  for (const c of current) {
    const prev = prevMap.get(c.instrumentName);
    const prevVol = prev?.volume24h ?? 0;

    // Volume delta within this snapshot interval
    const deltaVolume = Math.max(0, c.volume24h - prevVol);
    if (deltaVolume <= 0) continue;

    const unusualScore = Math.min(
      100,
      Math.round((deltaVolume / Math.max(1, avgVolume)) * UNUSUAL_SCORE_MULTIPLIER),
    );

    // Premium estimate: deltaVolume × markPrice (markPrice already in USD)
    const premiumUsd = deltaVolume * c.markPrice;

    if (c.optionType === 'call') {
      netCallPremium += premiumUsd;
    } else {
      netPutPremium += premiumUsd;
    }

    events.push({
      id: `${c.instrumentName}:${now}`,
      timestamp: now,
      asset,
      expiration: c.expirationDate.toISOString().slice(0, 10),
      strike: c.strike,
      optionType: c.optionType,
      side: 'unknown',
      size: deltaVolume,
      premiumUsd,
      unusualScore,
      instrumentName: c.instrumentName,
    });
  }

  // Sort by unusualScore descending
  events.sort((a, b) => b.unusualScore - a.unusualScore);

  return {
    asset,
    window: '1h',
    generatedAt: now,
    events,
    netCallPremium,
    netPutPremium,
    netPremiumFlow: netCallPremium - netPutPremium,
  };
}
