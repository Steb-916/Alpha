/**
 * GET /api/market/health?symbol=BTC
 *
 * Composite Health Score in the app's internal `HealthScore` shape.
 *
 * Strategy:
 *   1. Try to read funding/oi/basis from cache (populated by their own routes
 *      or by the screener cron). If any are missing, fetch them inline via
 *      the aggregator.
 *   2. Read the liquidation snapshot Redis key written by the SSE pipeline
 *      (Step 6 of the plan). If absent, scoreLiquidation() returns a neutral 15.
 *   3. Compute the composite, cache for 60s with stale fallback.
 */

import { NextResponse } from 'next/server';
import { resolveAsset } from '@/config/assets';
import {
  getCached,
  withCacheAndStale,
} from '@/lib/cache/redis';
import {
  aggregateBasis,
  aggregateFunding,
  aggregateOI,
} from '@/lib/market/aggregator';
import {
  computeHealthScore,
  LIQ_SNAPSHOT_KEY,
  type LiqSnapshot,
} from '@/lib/market/health';
import { generateHealthScore } from '@/lib/mockData';
import type { BasisData, FundingData, OpenInterestData } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 60;

async function getOrCompute<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T | null> {
  try {
    const cached = await getCached<T>(key);
    if (cached) return cached;
    const fresh = await fetcher();
    return fresh;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol') || 'BTC';
  const cfg = resolveAsset(symbolParam);
  if (!cfg) {
    return NextResponse.json(
      { error: `Unsupported symbol: ${symbolParam}` },
      { status: 400 },
    );
  }

  if (process.env.NEXT_PUBLIC_LIVE_DATA_ENABLED === 'false') {
    return NextResponse.json(generateHealthScore(cfg.symbol));
  }

  try {
    const data = await withCacheAndStale(
      `market:health:${cfg.symbol}`,
      TTL_SECONDS,
      async () => {
        const [funding, oi, basis, liquidation] = await Promise.all([
          getOrCompute<FundingData>(
            `market:funding:${cfg.symbol}`,
            60,
            () => aggregateFunding(cfg.symbol),
          ),
          getOrCompute<OpenInterestData>(
            `market:oi:${cfg.symbol}`,
            30,
            () => aggregateOI(cfg.symbol),
          ),
          getOrCompute<BasisData>(
            `market:basis:${cfg.symbol}`,
            30,
            () => aggregateBasis(cfg.symbol),
          ),
          getCached<LiqSnapshot>(LIQ_SNAPSHOT_KEY(cfg.binance)),
        ]);

        return computeHealthScore({
          symbol: cfg.symbol,
          funding,
          oi,
          basis,
          liquidation,
        });
      },
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/market/health] ${cfg.symbol} failed:`, err);
    return NextResponse.json(
      { ...generateHealthScore(cfg.symbol), _stale: true, _mock: true },
      { status: 200 },
    );
  }
}
