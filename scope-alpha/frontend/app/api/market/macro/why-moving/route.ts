/**
 * GET /api/market/macro/why-moving?asset=BTC
 *
 * "Why Is Price Moving?" engine — v2 Phase 6 synthesis feature.
 * Checks all cached data domains for anomalies when price moves > threshold,
 * then surfaces the most likely driver as a narrative insight card.
 */

import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { fetchCoinGeckoClose, fetchFearGreed } from '@/lib/macro/fetchers';
import type { FundingData } from '@/lib/types';
import type { OnChainOverview } from '@/lib/onchain/types';
import type { MacroConvergenceScore } from '@/types/macro';
import type { WhyMovingResult, WhyMovingSignal } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 300; // 5 min — short TTL, needs to be fresh
const ALLOWED = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'ARB']);

// ─── Signal detectors ─────────────────────────────────────────────────────────

function detectFundingSignal(funding: FundingData | null, priceChange: number): WhyMovingSignal | null {
  if (!funding) return null;
  const z = funding.zScore ?? 0;
  const currentRate = funding.currentRate ?? 0;

  if (priceChange < -3 && z > 2) {
    return {
      domain: 'Derivatives',
      observation: `Funding z-score at ${z.toFixed(1)} — overheated longs being flushed out. Cascading long liquidations likely driving the move.`,
      severity: 'high',
    };
  }
  if (priceChange > 3 && z < -1.5) {
    return {
      domain: 'Derivatives',
      observation: `Negative funding (z=${z.toFixed(1)}) being unwound — short squeeze in progress. Forced short covering amplifying the upside.`,
      severity: 'high',
    };
  }
  if (Math.abs(z) > 1.5) {
    return {
      domain: 'Derivatives',
      observation: `Funding rate ${currentRate > 0 ? 'elevated' : 'negative'} (z=${z.toFixed(1)}) — derivatives positioning is amplifying the move.`,
      severity: 'medium',
    };
  }
  return null;
}

function detectOnChainSignal(onchain: OnChainOverview | null, priceChange: number): WhyMovingSignal | null {
  if (!onchain) return null;
  // supplyOnExchanges is a % — rising = coins moving to exchange (bearish)
  const supplyOnExchange = onchain.supplyOnExchanges ?? null;
  const sopr = onchain.sopr ?? null;

  if (priceChange < -3 && supplyOnExchange != null && supplyOnExchange > 12) {
    return {
      domain: 'On-Chain',
      observation: `Exchange supply elevated at ${supplyOnExchange.toFixed(1)}% — large holders moving coins to exchanges. Distribution pressure likely contributing to the drop.`,
      severity: 'high',
    };
  }
  if (priceChange > 3 && supplyOnExchange != null && supplyOnExchange < 8) {
    return {
      domain: 'On-Chain',
      observation: `Exchange supply low at ${supplyOnExchange.toFixed(1)}% — coins moving off exchanges signals accumulation. Reduced sell-side supply supports the rally.`,
      severity: 'medium',
    };
  }
  if (sopr != null && sopr < 0.97 && priceChange < -2) {
    return {
      domain: 'On-Chain',
      observation: `SOPR at ${sopr.toFixed(3)} — market-wide capitulation signal. Holders selling at a loss indicates forced or panic selling.`,
      severity: 'high',
    };
  }
  return null;
}

function detectSentimentSignal(fgValue: number, priceChange: number): WhyMovingSignal | null {
  if (fgValue <= 15 && priceChange < -5) {
    return {
      domain: 'Sentiment',
      observation: `Fear & Greed at ${fgValue} — Extreme Fear. Panic selling cascade in progress. Historically a contrarian accumulation zone.`,
      severity: 'high',
    };
  }
  if (fgValue >= 85 && priceChange > 5) {
    return {
      domain: 'Sentiment',
      observation: `Fear & Greed at ${fgValue} — Extreme Greed. FOMO-driven buying. Historically associated with local tops.`,
      severity: 'medium',
    };
  }
  if (Math.abs(priceChange) > 3) {
    const bias = fgValue > 60 ? 'bullish sentiment is amplifying' : fgValue < 40 ? 'fearful sentiment is amplifying' : 'sentiment is neutral toward';
    return {
      domain: 'Sentiment',
      observation: `Fear & Greed at ${fgValue} — ${bias} the move.`,
      severity: 'low',
    };
  }
  return null;
}

function detectConvergenceSignal(
  convergence: MacroConvergenceScore | null,
  priceChange: number,
): WhyMovingSignal | null {
  if (!convergence) return null;
  if (convergence.confidence === 'high' && convergence.direction === 'bearish' && priceChange < -2) {
    return {
      domain: 'Multi-Domain',
      observation: `High-conviction bearish convergence (${convergence.agreementCount}/3 domains aligned). The move is not isolated — derivatives, on-chain, and macro all point lower.`,
      severity: 'high',
    };
  }
  if (convergence.confidence === 'high' && convergence.direction === 'bullish' && priceChange > 2) {
    return {
      domain: 'Multi-Domain',
      observation: `High-conviction bullish convergence (${convergence.agreementCount}/3 domains aligned). Multiple indicators supported this move before it began.`,
      severity: 'medium',
    };
  }
  return null;
}

// ─── Narrative builder ────────────────────────────────────────────────────────

function buildNarrative(
  asset: string,
  priceChange24h: number,
  primary: WhyMovingSignal | null,
  secondary: WhyMovingSignal[],
  isMoving: boolean,
): string {
  if (!isMoving) {
    return `${asset} is trading within normal range (${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(1)}% in 24h). No anomalous cross-domain signals detected.`;
  }

  const direction = priceChange24h > 0 ? 'up' : 'down';
  const abs = Math.abs(priceChange24h).toFixed(1);

  if (!primary) {
    return `${asset} moved ${direction} ${abs}% in 24h. No single dominant driver identified — the move appears broad-based or driven by factors outside tracked domains.`;
  }

  let narrative = `${asset} ${direction} ${abs}% in 24h. Primary driver: ${primary.domain} — ${primary.observation}`;
  if (secondary.length > 0) {
    narrative += ` Secondary signal: ${secondary[0].observation}`;
  }
  return narrative;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'Asset not supported' }, { status: 400 });
  }

  const key = `macro:why-moving:${asset}`;
  const fresh = await getCached<WhyMovingResult>(key);
  if (fresh) return NextResponse.json(fresh);

  try {
    const [prices, funding, onchain, fgHistory, convergence] = await Promise.all([
      fetchCoinGeckoClose(asset as 'BTC' | 'ETH', 3).then((pts) => pts.map((p) => p.close)).catch(() => []),
      getCached<FundingData>(`market:funding:${asset}`),
      getCached<OnChainOverview>(`onchain:overview:${asset}`),
      fetchFearGreed(2),
      getCached<MacroConvergenceScore>(`macro:convergence:${asset}`),
    ]);

    // Compute 24h price change from last 2 daily closes
    let priceChange24h = 0;
    if (prices.length >= 2) {
      const prev = prices[prices.length - 2];
      const curr = prices[prices.length - 1];
      if (prev > 0) priceChange24h = ((curr - prev) / prev) * 100;
    }

    const MOVE_THRESHOLD = 3; // percent
    const isMoving = Math.abs(priceChange24h) >= MOVE_THRESHOLD;

    const currentFg = fgHistory[0]?.value ?? 50;

    // Collect all signals
    const allSignals: WhyMovingSignal[] = [];
    const fundingSig = detectFundingSignal(funding, priceChange24h);
    const onchainSig = detectOnChainSignal(onchain, priceChange24h);
    const sentimentSig = detectSentimentSignal(currentFg, priceChange24h);
    const convergenceSig = detectConvergenceSignal(convergence, priceChange24h);

    if (fundingSig) allSignals.push(fundingSig);
    if (onchainSig) allSignals.push(onchainSig);
    if (convergenceSig) allSignals.push(convergenceSig);
    if (sentimentSig) allSignals.push(sentimentSig);

    // Sort: high > medium > low, then convergence first for tie-breaking
    const severityOrder = { high: 0, medium: 1, low: 2 };
    allSignals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const primary = allSignals[0] ?? null;
    const secondary = allSignals.slice(1, 3);

    const result: WhyMovingResult = {
      asset,
      priceChange24h,
      isMoving,
      primaryDriver: primary,
      secondaryDrivers: secondary,
      narrative: buildNarrative(asset, priceChange24h, primary, secondary, isMoving),
      computedAt: new Date().toISOString(),
    };

    await Promise.all([setCached(key, result, TTL), setStale(key, result)]);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[macro/why-moving] failed:', err);
    const stale = await getStale<WhyMovingResult>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Why-moving data unavailable' }, { status: 503 });
  }
}
