/**
 * GET /api/market/onchain/supply?asset=BTC
 *
 * Slice 1 deliverable: MVRV z-score live via CoinMetrics + Quant Engine.
 * SOPR returns null in v1 — arrives in Slice 2 with the public-chain
 * provider. The response shape includes the SOPR slot from day one so the
 * UI's stub card is forward-compatible.
 *
 * Cache-first on the overlay key. Misses trigger a fetch from the provider
 * + Quant Engine and re-cache for 6h (matches PRD §5 supply TTL). If
 * either dependency is absent, returns 503 with flags describing why.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { getOnChainProvider } from '@/lib/onchain';
import { quantEngine } from '@/lib/quant-engine';
import type {
  MVRVOutput,
  OnChainAsset,
  OnChainSupplyResponse,
} from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const CACHE_TTL_SECONDS = 21600; // 6h — matches daily provider cadence.
const LOOKBACK_DAYS = 1460; // ~4 years for a meaningful z-score distribution.

function cacheKey(asset: OnChainAsset): string {
  return `onchain:supply:${asset}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(raw as OnChainAsset)) {
    return NextResponse.json(
      { error: 'On-chain data only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = raw as OnChainAsset;

  const key = cacheKey(asset);
  const fresh = await getCached<OnChainSupplyResponse>(key);
  if (fresh) return NextResponse.json(fresh);

  const provider = getOnChainProvider();
  const quantEngineConfigured = quantEngine.configured;

  if (!provider.configured || !quantEngineConfigured) {
    const stale = await getStale<OnChainSupplyResponse>(key);
    if (stale) {
      return NextResponse.json({ ...stale, staleness: 'stale' as const });
    }
    return NextResponse.json(
      {
        error: 'On-chain supply unavailable',
        asset,
        provider_configured: provider.configured,
        quant_engine_configured: quantEngineConfigured,
      },
      { status: 503 },
    );
  }

  const supply = await provider.fetchSupplyMetrics(asset, LOOKBACK_DAYS);
  if (!supply || supply.series.length < 30) {
    const stale = await getStale<OnChainSupplyResponse>(key);
    if (stale) {
      return NextResponse.json({ ...stale, staleness: 'stale' as const });
    }
    return NextResponse.json(
      {
        error: 'Provider returned insufficient MVRV history',
        asset,
        provider_configured: provider.configured,
        quant_engine_configured: quantEngineConfigured,
      },
      { status: 503 },
    );
  }

  const mvrvSeries = supply.series
    .filter((p) => p.mvrv != null && Number.isFinite(p.mvrv))
    .map((p) => ({ timestamp: p.timestamp, mvrv: p.mvrv as number }));

  let mvrv: MVRVOutput | null = null;
  if (mvrvSeries.length >= 30) {
    mvrv = await quantEngine.computeMVRV({
      asset,
      series: mvrvSeries,
      lookback_days: LOOKBACK_DAYS,
    });
  }

  if (!mvrv || mvrv.series.length === 0) {
    const stale = await getStale<OnChainSupplyResponse>(key);
    if (stale) {
      return NextResponse.json({ ...stale, staleness: 'stale' as const });
    }
    return NextResponse.json(
      {
        error: 'MVRV compute returned empty output',
        asset,
        provider_configured: provider.configured,
        quant_engine_configured: quantEngineConfigured,
      },
      { status: 503 },
    );
  }

  const overlay: OnChainSupplyResponse = {
    asset,
    mvrv,
    sopr: null, // Slice 2 — requires a public-chain provider.
    staleness: 'fresh',
    provider_configured: true,
    quant_engine_configured: true,
  };

  await setCached(key, overlay, CACHE_TTL_SECONDS);
  return NextResponse.json(overlay);
}
