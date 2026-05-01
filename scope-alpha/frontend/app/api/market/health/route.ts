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
import { prisma } from '@/lib/prisma';
import { persistHealthScoreSnapshot } from '@/lib/market/persistence';
import type { BasisData, FundingData, OpenInterestData } from '@/lib/types';
import type { SnapshotLite } from '@/lib/analytics/trend';
import { fetchOnChainOverview, fetchExchangeFlows } from '@/lib/onchain/coinmetrics';
import type { OnChainOverview, ExchangeFlowData } from '@/lib/onchain/types';

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
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const ONCHAIN_ASSETS = new Set(['BTC', 'ETH']);
        const supportsOnchain = ONCHAIN_ASSETS.has(cfg.symbol);

        const [funding, oi, basis, liquidation, historyRows, onchainData, onchainFlows] = await Promise.all([
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
          prisma.healthScoreSnapshot
            .findMany({
              where: {
                asset: cfg.symbol,
                timestamp: { gte: sevenDaysAgo },
              },
              orderBy: { timestamp: 'asc' },
              take: 200,
            })
            .catch(() => []),
          supportsOnchain
            ? getCached<OnChainOverview>(`onchain:overview:${cfg.symbol}`)
                .then((c) => c ?? fetchOnChainOverview(cfg.symbol).catch(() => null))
            : Promise.resolve(null),
          supportsOnchain
            ? getCached<ExchangeFlowData>(`onchain:flows:${cfg.symbol}:7`)
                .then((c) => c ?? fetchExchangeFlows(cfg.symbol, 7).catch(() => null))
            : Promise.resolve(null),
        ]);

        const history: SnapshotLite[] = historyRows.map((r) => ({
          score: r.score,
          funding: r.funding,
          oi: r.oi,
          liquidation: r.liquidation,
          basis: r.basis,
          timestamp: r.timestamp,
        }));

        const result = computeHealthScore({
          symbol: cfg.symbol,
          funding,
          oi,
          basis,
          liquidation,
          history,
          onchainData,
          onchainFlows,
        });

        // Fire-and-forget: persist this hour's snapshot. Idempotent via
        // @@unique(asset, timestamp) with hour-floored timestamp.
        void persistHealthScoreSnapshot({
          asset: cfg.symbol,
          score: result.score,
          regime: result.regimeV2 ?? result.regime,
          funding: result.components.funding,
          oi: result.components.oi,
          liquidation: result.components.liquidation,
          basis: result.components.basis,
          timestamp: new Date(),
        });

        return result;
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
