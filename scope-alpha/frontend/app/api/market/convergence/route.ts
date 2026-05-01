/**
 * GET /api/market/convergence?asset=BTC
 *
 * Returns a 3-domain convergence score combining:
 *  - Derivatives health score
 *  - On-chain signals (MVRV, SOPR, exchange flows)
 *  - Options (RND skewness, if quant engine available)
 */

import { NextResponse } from 'next/server';
import { getCached, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchOnChainOverview, fetchExchangeFlows } from '@/lib/onchain/coinmetrics';
import { computeConvergence, type ConvergenceScore } from '@/lib/analytics/convergence';
import { aggregateFunding, aggregateOI, aggregateBasis } from '@/lib/market/aggregator';
import {
  computeHealthScore,
  LIQ_SNAPSHOT_KEY,
  type LiqSnapshot,
} from '@/lib/market/health';
import { resolveAsset } from '@/config/assets';
import type { FundingData, OpenInterestData, BasisData } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 5 * 60; // 5 minutes

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();

  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'Convergence available for BTC and ETH only' }, { status: 400 });
  }

  const cacheKey = `market:convergence:${asset}`;
  const fresh = await getCached<ConvergenceScore>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  const cfg = resolveAsset(asset);

  try {
    const [funding, oi, basis, liqSnap, onchain, flows] = await Promise.all([
      getCached<FundingData>(`market:funding:${asset}`)
        .then((c) => c ?? aggregateFunding(asset).catch(() => null))
        .catch(() => null),
      getCached<OpenInterestData>(`market:oi:${asset}`)
        .then((c) => c ?? aggregateOI(asset).catch(() => null))
        .catch(() => null),
      getCached<BasisData>(`market:basis:${asset}`)
        .then((c) => c ?? aggregateBasis(asset).catch(() => null))
        .catch(() => null),
      cfg ? getCached<LiqSnapshot>(LIQ_SNAPSHOT_KEY(cfg.binance)) : Promise.resolve(null),
      fetchOnChainOverview(asset).catch(() => null),
      fetchExchangeFlows(asset, 7).catch(() => null),
    ]);

    const healthResult = computeHealthScore({
      symbol: asset,
      funding: funding ?? null,
      oi: oi ?? null,
      basis: basis ?? null,
      liquidation: liqSnap ?? null,
      onchainData: onchain,
      onchainFlows: flows,
    });
    const healthScore = healthResult.score;

    // RND skewness is unavailable without quant engine — set to null gracefully
    const rndSkewness: number | null = null;

    const result = computeConvergence({
      healthScore,
      onchain,
      flows,
      rndSkewness,
    });

    await writeFreshAndStale(cacheKey, result, CACHE_TTL);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[market/convergence] ${asset} failed:`, err);
    return NextResponse.json({ error: 'Convergence score unavailable' }, { status: 503 });
  }
}
