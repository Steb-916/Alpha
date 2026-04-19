/**
 * GET /api/market/regime/current?asset=BTC
 *
 * Cache + compute-only. **Persistence lives in
 * `/api/cron/refresh-regime-convergence`** — the sole writer of
 * `RegimeSnapshot` rows (predictable 1/day on Hobby, 24/day on Pro).
 *
 * This route reads the latest persisted row for the persistence-filter's
 * prev-regime context but never writes back; cache TTL (3600s) provides
 * intraday freshness without adding DB noise whose cadence depends on
 * user traffic.
 *
 * Trade-off: a regime transition occurring between 03:00 UTC runs isn't
 * persisted until the next day's cron. The live cache reflects it
 * immediately for active users. For historical timeline / forward-returns
 * analytics, this means up to 24h of persistence latency on transitions —
 * acceptable given the 2-day commit rule already in force.
 *
 * Miss path:
 *   1. Fetch the latest persisted RegimeSnapshot row for prev-regime context.
 *   2. Assemble cache snapshot + build feature vector.
 *   3. Call quantEngine.classifyRegime with persistence-filter context.
 *   4. Warm Redis cache + return envelope. (NO Prisma write.)
 *
 * Returns 503 when Quant Engine is inert. Non-BTC/ETH assets return 400
 * (regime classifier is BTC+ETH-only in v1).
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { quantEngine } from '@/lib/quant-engine';
import {
  assembleCacheSnapshot,
  buildFeatureVectorFromSnapshot,
} from '@/lib/regime/feature-builder';
import type {
  OnChainAsset,
} from '@/types/onchain';
import type {
  RegimeCurrentResponse,
  RegimeLabel,
} from '@/types/regime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const CACHE_TTL = 3600;

function cacheKey(asset: OnChainAsset): string {
  return `regime:current:${asset}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(raw as OnChainAsset)) {
    return NextResponse.json(
      { error: 'Regime classifier available only for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = raw as OnChainAsset;

  const fresh = await getCached<RegimeCurrentResponse>(cacheKey(asset));
  if (fresh) return NextResponse.json(fresh);

  if (!quantEngine.configured) {
    const stale = await getStale<RegimeCurrentResponse>(cacheKey(asset));
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Regime classification unavailable — Quant Engine not configured',
        asset,
        quant_engine_configured: false,
      },
      { status: 503 },
    );
  }

  // Previous snapshot — feeds persistence filter
  const prevSnapshot = await prisma.regimeSnapshot.findFirst({
    where: { asset },
    orderBy: { timestamp: 'desc' },
  });

  const timestamp = new Date().toISOString();
  const snapshot = await assembleCacheSnapshot(asset, timestamp);
  const featureVector = buildFeatureVectorFromSnapshot(snapshot);

  const classification = await quantEngine.classifyRegime({
    asset,
    feature_vector: featureVector,
    prev_regime: (prevSnapshot?.committedRegime as RegimeLabel | undefined) ?? null,
    prev_raw_classification:
      (prevSnapshot?.rawClassification as RegimeLabel | undefined) ?? null,
  });

  if (!classification) {
    const stale = await getStale<RegimeCurrentResponse>(cacheKey(asset));
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      {
        error: 'Quant Engine returned null — check deployment',
        asset,
        quant_engine_configured: true,
      },
      { status: 503 },
    );
  }

  // NO Prisma write here — cron at /api/cron/refresh-regime-convergence owns
  // RegimeSnapshot persistence. Cache warm + serve is this route's only job.

  // Days in regime: count days back to the previous regime transition that
  // committed to this regime. Computed from persisted snapshots only; a
  // transition happening between cron runs won't show up here until the
  // next cron lands.
  const tsDate = new Date(timestamp);
  const priorTransition = await prisma.regimeSnapshot.findFirst({
    where: {
      asset,
      regimeChanged: true,
      committedRegime: classification.committed_regime,
    },
    orderBy: { timestamp: 'desc' },
  });
  const daysInRegime = priorTransition
    ? Math.max(
        0,
        Math.floor(
          (tsDate.getTime() - priorTransition.timestamp.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      )
    : null;

  const overlay: RegimeCurrentResponse = {
    asset,
    classification,
    feature_vector: featureVector,
    days_in_regime: daysInRegime,
    computed_at: timestamp,
    staleness: 'fresh',
    quant_engine_configured: true,
  };

  await setCached(cacheKey(asset), overlay, CACHE_TTL);
  return NextResponse.json(overlay);
}
