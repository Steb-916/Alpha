/**
 * GET /api/tools/arb-scanner
 *
 * Scans all enabled assets for funding + basis arb opportunities.
 * Reads live funding + basis from the aggregator and historical funding
 * spreads from FundingRateSnapshot for stability + z-score. Cache TTL 60s.
 */

import { NextResponse } from 'next/server';
import { ENABLED_ASSETS } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import {
  aggregateFunding,
  aggregateBasis,
} from '@/lib/market/aggregator';
import {
  buildBasisOpportunity,
  buildFundingOpportunity,
  fundingFromData,
  basisFromData,
  sortOpportunities,
  type ArbOpportunity,
} from '@/lib/analytics/arb-scanner';
import { prisma } from '@/lib/prisma';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TTL_SECONDS = 60;

interface ArbScannerResponse {
  opportunities: ArbOpportunity[];
  updatedAt: string;
  assetsScanned: number;
  errors: number;
}

export async function GET() {
  try {
    const data = await withCacheAndStale<ArbScannerResponse>(
      'tools:arb-scanner',
      TTL_SECONDS,
      async () => {
        const thirtyDaysAgo = new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        );

        // Batch fetch 30d funding history across all enabled assets in one query.
        const assetSymbols = ENABLED_ASSETS.map((a) => a.symbol);
        const allHistoryRows = await prisma.fundingRateSnapshot
          .findMany({
            where: {
              asset: { in: assetSymbols },
              timestamp: { gte: thirtyDaysAgo },
            },
            orderBy: { timestamp: 'asc' },
          })
          .catch(() => []);

        // Group by asset → timestamp → {binance, bybit} so we can subtract.
        const spreadHistoryByAsset = new Map<string, number[]>();
        for (const sym of assetSymbols) spreadHistoryByAsset.set(sym, []);

        const grouped = new Map<
          string,
          Map<number, { binance?: number; bybit?: number }>
        >();
        for (const r of allHistoryRows) {
          let byTs = grouped.get(r.asset);
          if (!byTs) {
            byTs = new Map();
            grouped.set(r.asset, byTs);
          }
          const key = r.timestamp.getTime();
          const slot = byTs.get(key) ?? {};
          if (r.exchange === 'binance') slot.binance = r.rate;
          else if (r.exchange === 'bybit') slot.bybit = r.rate;
          byTs.set(key, slot);
        }
        for (const [asset, byTs] of grouped.entries()) {
          const arr: number[] = [];
          for (const slot of byTs.values()) {
            if (slot.binance != null && slot.bybit != null) {
              arr.push(slot.binance - slot.bybit);
            }
          }
          spreadHistoryByAsset.set(asset, arr);
        }

        // Fetch live funding + basis for each asset in parallel batches.
        const opportunities: ArbOpportunity[] = [];
        let errors = 0;

        const BATCH_SIZE = 5;
        for (let i = 0; i < ENABLED_ASSETS.length; i += BATCH_SIZE) {
          const batch = ENABLED_ASSETS.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (asset) => {
              const [funding, basis] = await Promise.allSettled([
                aggregateFunding(asset.symbol),
                aggregateBasis(asset.symbol),
              ]);
              return {
                asset,
                funding:
                  funding.status === 'fulfilled' ? funding.value : null,
                basis: basis.status === 'fulfilled' ? basis.value : null,
              };
            }),
          );

          for (const r of results) {
            if (r.status !== 'fulfilled') {
              errors++;
              continue;
            }
            const { asset, funding, basis } = r.value;

            if (funding) {
              const rates = fundingFromData(funding);
              if (rates.binance != null && rates.bybit != null) {
                const history = spreadHistoryByAsset.get(asset.symbol) ?? [];
                const op = buildFundingOpportunity({
                  asset: asset.symbol,
                  binanceRate: rates.binance,
                  bybitRate: rates.bybit,
                  history,
                });
                if (op) opportunities.push(op);
              }
            }

            if (basis) {
              const legs = basisFromData(basis);
              if (legs.binance != null && legs.bybit != null) {
                const op = buildBasisOpportunity({
                  asset: asset.symbol,
                  binanceBasis: legs.binance,
                  bybitBasis: legs.bybit,
                });
                if (op) opportunities.push(op);
              }
            }
          }
        }

        return {
          opportunities: sortOpportunities(opportunities),
          updatedAt: new Date().toISOString(),
          assetsScanned: ENABLED_ASSETS.length,
          errors,
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/tools/arb-scanner' });
    return NextResponse.json(
      { error: 'Failed to compute arb opportunities' },
      { status: 500 },
    );
  }
}
