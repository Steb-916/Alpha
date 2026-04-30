/**
 * GET /api/market/onchain/exchange-flows?asset=BTC&days=30
 *
 * Returns time series of exchange inflow, outflow, and net flow
 * for the given asset over the specified number of days.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchExchangeFlows } from '@/lib/onchain/coinmetrics';
import type { ExchangeFlowData } from '@/lib/onchain/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 90 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get('days') || '30', 10)));

  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'On-chain data available for BTC and ETH only' },
      { status: 400 },
    );
  }

  const cacheKey = `onchain:flows:${asset}`;

  const fresh = await getCached<ExchangeFlowData>(cacheKey);
  if (fresh) return NextResponse.json({ ...fresh, days });

  try {
    const data = await fetchExchangeFlows(asset, days);
    await writeFreshAndStale(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[onchain/exchange-flows] ${asset} fetch failed:`, err);
    const stale = await getStale<ExchangeFlowData>(cacheKey);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Exchange flow data unavailable — trigger the refresh-onchain cron' },
      { status: 503 },
    );
  }
}
