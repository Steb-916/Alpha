/**
 * GET /api/market/onchain/insights?asset=BTC
 *
 * Returns cross-domain divergence insight cards combining on-chain signals
 * with derivatives (funding) data.
 */

import { NextResponse } from 'next/server';
import { getCached, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchOnChainOverview, fetchExchangeFlows } from '@/lib/onchain/coinmetrics';
import { generateInsights } from '@/lib/analytics/onchain-insights';
import { aggregateFunding } from '@/lib/market/aggregator';
import type { InsightCard } from '@/lib/onchain/types';
import type { FundingData } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 15 * 60; // 15 minutes

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();

  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'Insights available for BTC and ETH only' }, { status: 400 });
  }

  const cacheKey = `onchain:insights:${asset}`;
  const fresh = await getCached<InsightCard[]>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const [onchain, exchangeFlows, fundingRes] = await Promise.all([
      fetchOnChainOverview(asset).catch(() => null),
      fetchExchangeFlows(asset, 7).catch(() => null),
      getCached<FundingData>(`market:funding:${asset}`)
        .then((cached) => cached ?? aggregateFunding(asset).catch(() => null))
        .catch(() => null),
    ]);

    // We don't have priceChange24h from on-chain data directly;
    // derive it from the last two price entries in exchange flows
    let priceChange24h: number | null = null;
    if (exchangeFlows && exchangeFlows.points.length >= 2) {
      // Exchange flows points don't carry price — use a reasonable default
      // In production you'd fetch from /api/market/price or spot ticker
      priceChange24h = null;
    }

    const cards = generateInsights({
      asset,
      onchain,
      exchangeFlows,
      funding: fundingRes,
      priceChange24h,
    });

    await writeFreshAndStale(cacheKey, cards, CACHE_TTL);
    return NextResponse.json(cards);
  } catch (err) {
    console.error(`[onchain/insights] ${asset} failed:`, err);
    return NextResponse.json([], { status: 200 });
  }
}
