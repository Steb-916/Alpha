/**
 * GET /api/market/regime/forward-returns?asset=BTC&regime=trending_bull
 *
 * Historical forward-return distribution for an (asset, regime) pair.
 * Cache-first (86400s). Miss → build observation list from RegimeSnapshot
 * rows + price series from CandleHistory → Quant Engine
 * `/regime/forward-returns` → persist cache.
 *
 * Day one observations are backfill-derived (no persisted RegimeSnapshot
 * history yet). As live snapshots accumulate, the `source` field
 * transitions from "backfill" → "mixed" → eventually "live".
 */

import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { quantEngine } from '@/lib/quant-engine';
import type { OnChainAsset } from '@/types/onchain';
import type {
  RegimeForwardReturnsResponse,
  RegimeLabel,
  ForwardReturnsObservation,
} from '@/types/regime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ASSETS = new Set<OnChainAsset>(['BTC', 'ETH']);
const ALLOWED_REGIMES: RegimeLabel[] = [
  'trending_bull',
  'trending_bear',
  'range_bound',
  'volatility_expansion',
  'capitulation',
];
const CACHE_TTL = 86400;

function cacheKey(asset: OnChainAsset, regime: RegimeLabel): string {
  return `regime:forward_returns:${asset}:${regime}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawAsset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const rawRegime = url.searchParams.get('regime') as RegimeLabel | null;

  if (!ALLOWED_ASSETS.has(rawAsset as OnChainAsset)) {
    return NextResponse.json(
      { error: 'Forward returns available only for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = rawAsset as OnChainAsset;

  if (!rawRegime || !ALLOWED_REGIMES.includes(rawRegime)) {
    return NextResponse.json(
      { error: 'Unknown regime; must be one of: ' + ALLOWED_REGIMES.join(', ') },
      { status: 400 },
    );
  }

  const fresh = await getCached<RegimeForwardReturnsResponse>(
    cacheKey(asset, rawRegime),
  );
  if (fresh) return NextResponse.json(fresh);

  if (!quantEngine.configured) {
    const payload: RegimeForwardReturnsResponse = {
      asset,
      regime: rawRegime,
      distribution: null,
      quant_engine_configured: false,
    };
    return NextResponse.json(payload, { status: 503 });
  }

  // Build observations from persisted RegimeSnapshot rows matching the regime.
  // Pair with CandleHistory prices (1h resolution).
  const snapshots = await prisma.regimeSnapshot.findMany({
    where: { asset, committedRegime: rawRegime },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true },
  });

  if (snapshots.length === 0) {
    const payload: RegimeForwardReturnsResponse = {
      asset,
      regime: rawRegime,
      distribution: null,
      quant_engine_configured: true,
    };
    return NextResponse.json(payload);
  }

  // Price series — use CandleHistory 1d candles (daily resolution is fine
  // for 7d/30d/90d horizons) across the window from first observation
  // back to present. Broader window → more price-series points for horizon
  // lookups.
  const candles = await prisma.candleHistory.findMany({
    where: { asset, exchange: 'binance', timeframe: '1d' },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true, close: true },
  });

  const priceSeries = candles.map((c) => ({
    timestamp: c.timestamp.toISOString(),
    price: c.close,
  }));

  // Observations tagged as live (all from persisted RegimeSnapshot rows).
  // Backfill-derived observations would come from an offline ingest; not
  // implemented in the live API (the backfill parquet is local-only).
  const observations: ForwardReturnsObservation[] = snapshots.map((s) => ({
    timestamp: s.timestamp.toISOString(),
    price: 0, // price is looked up via full_price_series by timestamp
    source: 'live',
  }));

  const distribution = await quantEngine.forwardReturns({
    asset,
    regime: rawRegime,
    observations,
    full_price_series: priceSeries,
    lookback_years: 2,
  });

  const payload: RegimeForwardReturnsResponse = {
    asset,
    regime: rawRegime,
    distribution,
    quant_engine_configured: true,
  };

  if (distribution) {
    await setCached(cacheKey(asset, rawRegime), payload, CACHE_TTL);
  }
  return NextResponse.json(payload);
}
