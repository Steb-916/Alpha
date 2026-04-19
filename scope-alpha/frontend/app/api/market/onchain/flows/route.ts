/**
 * GET /api/market/onchain/flows?asset=BTC
 *
 * Cache-first. Miss → fetch from CoinMetrics + call Quant Engine flow-regime.
 * Returns 503 when provider unconfigured or Quant Engine inert (same shape
 * as supply route from Slice 1).
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { getOnChainProvider } from '@/lib/onchain';
import { quantEngine } from '@/lib/quant-engine';
import type {
  FlowRegimeOutput,
  OnChainAsset,
  OnChainFlowsResponse,
} from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const CACHE_TTL = 3_600; // 1h
const LOOKBACK_DAYS = 1460;

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
  const key = `onchain:flows:${asset}`;

  const fresh = await getCached<OnChainFlowsResponse>(key);
  if (fresh) return NextResponse.json(fresh);

  const provider = getOnChainProvider();
  const qeConfigured = quantEngine.configured;

  if (!provider.configured) {
    const stale = await getStale<OnChainFlowsResponse>(key);
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Flows unavailable — provider not configured',
        asset,
        provider_configured: false,
        quant_engine_configured: qeConfigured,
      },
      { status: 503 },
    );
  }

  const flows = await provider.fetchExchangeFlows(asset, LOOKBACK_DAYS);
  if (!flows) {
    const stale = await getStale<OnChainFlowsResponse>(key);
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Provider returned no flows series',
        asset,
        provider_configured: true,
        quant_engine_configured: qeConfigured,
      },
      { status: 503 },
    );
  }

  let regime: FlowRegimeOutput | null = null;
  if (qeConfigured && flows.series.length >= 35) {
    regime = await quantEngine.computeFlowRegime({
      asset,
      series: flows.series.map((p) => ({
        timestamp: p.timestamp,
        net_flow_usd: p.netFlowUsd,
      })),
    });
  }

  const overlay: OnChainFlowsResponse = {
    asset,
    series: flows.series,
    regime,
    staleness: 'fresh',
    provider_configured: true,
    quant_engine_configured: qeConfigured,
  };
  await setCached(key, overlay, CACHE_TTL);
  return NextResponse.json(overlay);
}
