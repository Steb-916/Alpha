/**
 * Cron-triggered on-chain data refresh.
 *
 * GET /api/cron/refresh-onchain
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * For BTC and ETH:
 *   1. Fetch on-chain metrics from CoinMetrics community API.
 *   2. Cache results in Upstash Redis (90-min TTL).
 *   3. Persist daily snapshots to PostgreSQL (idempotent upsert).
 *
 * For USDT and USDC:
 *   4. Fetch exchange flow metrics and cache stablecoin flow data.
 *
 * Schedule: hourly (0 * * * *) per vercel.json.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFreshAndStale } from '@/lib/cache/redis';
import {
  fetchOnChainOverview,
  fetchExchangeFlows,
  fetchSupplyMetrics,
  fetchStablecoinFlows,
} from '@/lib/onchain/coinmetrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS = ['BTC', 'ETH'] as const;
const CACHE_TTL = 90 * 60; // 90 minutes

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function refreshAsset(asset: string): Promise<{ overview: boolean; flows: boolean; supply: boolean }> {
  const result = { overview: false, flows: false, supply: false };

  // Overview (MVRV, SOPR, NVT, active addresses)
  try {
    const overview = await fetchOnChainOverview(asset);
    await writeFreshAndStale(`onchain:overview:${asset}`, overview, CACHE_TTL);

    // Persist to DB (upsert by day boundary)
    const ts = new Date(overview.timestamp);
    ts.setUTCHours(0, 0, 0, 0);
    await prisma.onChainSnapshot.upsert({
      where: { asset_timestamp: { asset, timestamp: ts } },
      update: {
        mvrvZScore: overview.mvrvZScore,
        sopr: overview.sopr,
        nvtRatio: overview.nvtRatio,
        activeAddresses: overview.activeAddresses,
        realizedCap: overview.realizedCap,
        marketCap: overview.marketCap,
      },
      create: {
        asset,
        timestamp: ts,
        mvrvZScore: overview.mvrvZScore,
        sopr: overview.sopr,
        nvtRatio: overview.nvtRatio,
        activeAddresses: overview.activeAddresses,
        supplyOnExchanges: overview.supplyOnExchanges,
        realizedCap: overview.realizedCap,
        marketCap: overview.marketCap,
      },
    });
    result.overview = true;
  } catch (err) {
    console.error(`[refresh-onchain] ${asset} overview failed:`, err);
  }

  // Exchange flows (30-day series)
  try {
    const flows = await fetchExchangeFlows(asset, 30);
    await writeFreshAndStale(`onchain:flows:${asset}`, flows, CACHE_TTL);

    // Persist latest day
    const latest = flows.points[flows.points.length - 1];
    if (latest) {
      const ts = new Date(latest.timestamp);
      ts.setUTCHours(0, 0, 0, 0);
      await prisma.exchangeFlowSnapshot.upsert({
        where: { asset_timestamp: { asset, timestamp: ts } },
        update: {
          inflowNative: latest.inflowNative,
          outflowNative: latest.outflowNative,
          netFlowNative: latest.netFlowNative,
          inflowUsd: latest.inflowUsd,
          outflowUsd: latest.outflowUsd,
          netFlowUsd: latest.netFlowUsd,
        },
        create: {
          asset,
          timestamp: ts,
          inflowNative: latest.inflowNative,
          outflowNative: latest.outflowNative,
          netFlowNative: latest.netFlowNative,
          inflowUsd: latest.inflowUsd,
          outflowUsd: latest.outflowUsd,
          netFlowUsd: latest.netFlowUsd,
        },
      });
    }
    result.flows = true;
  } catch (err) {
    console.error(`[refresh-onchain] ${asset} flows failed:`, err);
  }

  // Supply metrics (90-day series)
  try {
    const supply = await fetchSupplyMetrics(asset);
    await writeFreshAndStale(`onchain:supply:${asset}`, supply, CACHE_TTL);
    result.supply = true;
  } catch (err) {
    console.error(`[refresh-onchain] ${asset} supply failed:`, err);
  }

  return result;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, unknown> = {};

  // Refresh BTC and ETH in parallel
  const assetResults = await Promise.allSettled(
    ASSETS.map(async (asset) => {
      const r = await refreshAsset(asset);
      return { asset, ...r };
    }),
  );

  for (const r of assetResults) {
    if (r.status === 'fulfilled') {
      results[r.value.asset] = r.value;
    } else {
      results['error'] = r.reason?.message ?? 'Unknown error';
    }
  }

  // Stablecoin flows
  try {
    const stableFlows = await fetchStablecoinFlows();
    await writeFreshAndStale('onchain:stablecoin-flows', stableFlows, CACHE_TTL);
    results['stablecoins'] = { ok: true, points: stableFlows.points.length };
  } catch (err) {
    console.error('[refresh-onchain] stablecoin flows failed:', err);
    results['stablecoins'] = { ok: false };
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
  });
}
