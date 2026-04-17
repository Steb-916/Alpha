/**
 * Options flow anomaly scanner.
 *
 * Compares the current chain snapshot to the previous one (stored in Redis
 * at options:chain:previous:{asset}) and surfaces unusual activity:
 * volume spikes, OI surges, and outsized premium flows. When no previous
 * snapshot is available, OI-change anomalies are skipped but
 * volume/premium anomalies still fire.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type {
  AnomalySentiment,
  FlowAnomaly,
  FlowOutput,
  Significance,
} from '@/types/options';

const MIN_VOLUME_FOR_CONSIDERATION = 10;
const VOLUME_SPIKE_MULTIPLIER = 3;
const OI_CHANGE_PCT_THRESHOLD = 20;
const OI_CHANGE_ABS_THRESHOLD = 10;
const OI_SURGE_HIGH_THRESHOLD = 500;
const LARGE_PREMIUM_USD = 500_000;
const HIGH_PREMIUM_USD = 5_000_000;
const MEDIUM_PREMIUM_USD = 1_000_000;
const MAX_ANOMALIES = 20;

function premiumUsd(opt: OptionsChainEntry): number {
  return opt.volume24h * opt.markPrice;
}

function sigOrder(s: Significance): number {
  return s === 'high' ? 0 : s === 'medium' ? 1 : 2;
}

function sentimentForBuy(optionType: 'call' | 'put'): AnomalySentiment {
  return optionType === 'call' ? 'bullish' : 'bearish';
}

function sentimentForSell(optionType: 'call' | 'put'): AnomalySentiment {
  return optionType === 'call' ? 'bearish' : 'bullish';
}

export function detectFlowAnomalies(
  asset: string,
  currentChain: OptionsChainEntry[],
  previousChain: OptionsChainEntry[] | null,
): FlowOutput | null {
  if (currentChain.length === 0) return null;
  const spotPrice = currentChain[0].underlyingPrice;
  const anomalies: FlowAnomaly[] = [];

  const previousByInstrument = new Map<string, OptionsChainEntry>();
  if (previousChain) {
    for (const prev of previousChain) {
      previousByInstrument.set(prev.instrumentName, prev);
    }
  }

  for (const opt of currentChain) {
    if (opt.volume24h < MIN_VOLUME_FOR_CONSIDERATION) continue;

    const prev = previousByInstrument.get(opt.instrumentName) ?? null;
    const premium = premiumUsd(opt);
    const baseFields: Omit<
      FlowAnomaly,
      'anomaly_type' | 'volume_ratio' | 'premium_usd' | 'oi_change' | 'oi_change_pct' | 'sentiment' | 'significance' | 'description'
    > = {
      instrument: opt.instrumentName,
      asset: opt.asset,
      strike: opt.strike,
      option_type: opt.optionType,
      expiry_date: opt.expirationDate.toISOString(),
      days_to_expiry: opt.daysToExpiry,
      volume_24h: opt.volume24h,
      open_interest: opt.openInterest,
    };

    // 1) Volume spike — volume outsized vs OI-implied "typical"
    const typical = Math.max(opt.openInterest * 0.1, 50);
    if (opt.volume24h > typical * VOLUME_SPIKE_MULTIPLIER) {
      const ratio = opt.volume24h / Math.max(typical, 1);
      const significance: Significance =
        premium > HIGH_PREMIUM_USD
          ? 'high'
          : premium > MEDIUM_PREMIUM_USD
          ? 'medium'
          : 'low';
      anomalies.push({
        ...baseFields,
        anomaly_type: 'volume_spike',
        oi_change: 0,
        oi_change_pct: 0,
        volume_ratio: ratio,
        premium_usd: premium,
        sentiment: sentimentForBuy(opt.optionType),
        significance,
        description: `${opt.volume24h.toFixed(0)} contracts traded (${ratio.toFixed(1)}x typical). $${(premium / 1_000_000).toFixed(2)}M premium on ${opt.strike.toLocaleString()} ${opt.optionType}.`,
      });
    }

    // 2) OI surge — only meaningful with a previous snapshot
    if (prev && prev.openInterest > OI_CHANGE_ABS_THRESHOLD) {
      const oiChange = opt.openInterest - prev.openInterest;
      const oiChangePct = (oiChange / prev.openInterest) * 100;
      if (Math.abs(oiChangePct) >= OI_CHANGE_PCT_THRESHOLD) {
        const sentiment: AnomalySentiment =
          oiChange > 0
            ? sentimentForBuy(opt.optionType)
            : sentimentForSell(opt.optionType);
        const significance: Significance =
          Math.abs(oiChange) > OI_SURGE_HIGH_THRESHOLD ? 'high' : 'medium';
        anomalies.push({
          ...baseFields,
          anomaly_type: 'oi_surge',
          oi_change: oiChange,
          oi_change_pct: oiChangePct,
          volume_ratio: 0,
          premium_usd: premium,
          sentiment,
          significance,
          description: `OI ${oiChange > 0 ? 'surged' : 'dropped'} ${Math.abs(oiChangePct).toFixed(0)}% (${oiChange > 0 ? '+' : ''}${oiChange.toFixed(0)} contracts) on ${opt.strike.toLocaleString()} ${opt.optionType}.`,
        });
      }
    }

    // 3) Large absolute-premium flow on a single instrument
    if (premium > LARGE_PREMIUM_USD) {
      const significance: Significance =
        premium > HIGH_PREMIUM_USD
          ? 'high'
          : premium > MEDIUM_PREMIUM_USD
          ? 'medium'
          : 'low';
      anomalies.push({
        ...baseFields,
        anomaly_type: 'large_premium',
        oi_change: 0,
        oi_change_pct: 0,
        volume_ratio: 0,
        premium_usd: premium,
        sentiment: sentimentForBuy(opt.optionType),
        significance,
        description: `$${(premium / 1_000_000).toFixed(2)}M premium flow into ${opt.strike.toLocaleString()} ${opt.optionType} (${Math.round(opt.daysToExpiry)}d expiry).`,
      });
    }
  }

  // Summary: net premium flow split by option type
  let callPremium = 0;
  let putPremium = 0;
  for (const opt of currentChain) {
    const p = premiumUsd(opt);
    if (opt.optionType === 'call') callPremium += p;
    else putPremium += p;
  }
  const ratio = putPremium > 0 ? callPremium / putPremium : callPremium > 0 ? Infinity : 0;
  const bias: 'bullish' | 'bearish' | 'neutral' =
    ratio > 1.5 ? 'bullish' : ratio < 0.67 ? 'bearish' : 'neutral';

  anomalies.sort((a, b) => {
    const s = sigOrder(a.significance) - sigOrder(b.significance);
    return s !== 0 ? s : b.premium_usd - a.premium_usd;
  });

  return {
    asset,
    spot_price: spotPrice,
    anomalies: anomalies.slice(0, MAX_ANOMALIES),
    summary: {
      call_premium_usd: callPremium,
      put_premium_usd: putPremium,
      call_put_ratio: Number.isFinite(ratio) ? ratio : 0,
      bias,
    },
    computed_at: new Date().toISOString(),
  };
}
