/**
 * GET /api/market/onchain/network?asset=BTC
 *
 * Pure CoinMetrics pass-through — no Quant Engine dependency. This is the
 * one on-chain tab that renders even when QUANT_ENGINE_URL is unset.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { getOnChainProvider } from '@/lib/onchain';
import type { OnChainAsset, OnChainNetworkResponse } from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const CACHE_TTL = 3_600; // 1h
const LOOKBACK_DAYS = 365;

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
  const key = `onchain:network:${asset}`;

  const fresh = await getCached<OnChainNetworkResponse>(key);
  if (fresh) return NextResponse.json(fresh);

  const provider = getOnChainProvider();
  if (!provider.configured) {
    const stale = await getStale<OnChainNetworkResponse>(key);
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Network metrics unavailable — provider not configured',
        asset,
        provider_configured: false,
      },
      { status: 503 },
    );
  }

  const network = await provider.fetchNetworkMetrics(asset, LOOKBACK_DAYS);
  if (!network || network.series.length === 0) {
    const stale = await getStale<OnChainNetworkResponse>(key);
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Provider returned no network series',
        asset,
        provider_configured: true,
      },
      { status: 503 },
    );
  }

  const latest = network.series.at(-1);
  const overlay: OnChainNetworkResponse = {
    asset,
    series: network.series,
    current: {
      activeAddresses: latest?.activeAddresses ?? null,
      txCount: latest?.txCount ?? null,
      feesUsd: latest?.feesUsd ?? null,
      issuanceUsd: latest?.issuanceUsd ?? null,
    },
    staleness: 'fresh',
    provider_configured: true,
  };
  await setCached(key, overlay, CACHE_TTL);
  return NextResponse.json(overlay);
}
