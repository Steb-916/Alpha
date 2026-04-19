/**
 * Cron-triggered on-chain data refresh — Phase 5 Slice 2.
 *
 * GET /api/cron/refresh-onchain
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Schedule: daily at 02:00 UTC per vercel.json.
 *
 * Per asset (BTC, ETH):
 *   1. Fetch supply/flows/network series from CoinMetrics community tier.
 *   2. Call Quant Engine MVRV (supply.mvrv) + flow-regime (flows.netFlowUsd).
 *   3. Persist today's row into OnChainSnapshot + ExchangeFlowSnapshot.
 *   4. Warm Redis caches:
 *        onchain:supply:{asset}      (6h TTL)
 *        onchain:flows:{asset}       (1h TTL)
 *        onchain:network:{asset}     (1h TTL)
 *
 * Then single-call DefiLlama stablecoins:
 *   1. Persist StablecoinSnapshot for today.
 *   2. Warm onchain:stablecoins (1h TTL).
 *
 * NVT and SOPR are deferred — the TS Quant Engine stubs exist but no data
 * source is wired. See plan file §Known limitations.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setCached } from '@/lib/cache/redis';
import { getOnChainProvider, getStablecoinProvider } from '@/lib/onchain';
import { quantEngine } from '@/lib/quant-engine';
import type {
  MVRVOutput,
  FlowRegimeOutput,
  OnChainAsset,
  OnChainFlowsResponse,
  OnChainNetworkResponse,
  OnChainStablecoinsResponse,
  OnChainSupplyResponse,
  StablecoinAggregate,
  StablecoinChartPoint,
} from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS: OnChainAsset[] = ['BTC', 'ETH'];
const LOOKBACK_DAYS = 1460; // ~4y — sufficient for MVRV z-score baseline.
const SUPPLY_TTL = 21_600; // 6h
const FLOWS_TTL = 3_600; // 1h
const NETWORK_TTL = 3_600; // 1h
const STABLECOIN_TTL = 3_600; // 1h

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

interface AssetResult {
  asset: OnChainAsset;
  supplyPoints: number;
  flowsPoints: number;
  networkPoints: number;
  mvrvComputed: boolean;
  flowRegimeComputed: boolean;
  persistedSnapshots: number;
  persistedFlows: number;
  error?: string;
}

interface StablecoinResult {
  aggregateFetched: boolean;
  chartPoints: number;
  persistedRow: boolean;
  error?: string;
}

async function refreshAsset(asset: OnChainAsset): Promise<AssetResult> {
  const result: AssetResult = {
    asset,
    supplyPoints: 0,
    flowsPoints: 0,
    networkPoints: 0,
    mvrvComputed: false,
    flowRegimeComputed: false,
    persistedSnapshots: 0,
    persistedFlows: 0,
  };

  const provider = getOnChainProvider();
  const quantConfigured = quantEngine.configured;

  try {
    const [supply, flows, network] = await Promise.all([
      provider.fetchSupplyMetrics(asset, LOOKBACK_DAYS),
      provider.fetchExchangeFlows(asset, LOOKBACK_DAYS),
      provider.fetchNetworkMetrics(asset, LOOKBACK_DAYS),
    ]);

    result.supplyPoints = supply?.series.length ?? 0;
    result.flowsPoints = flows?.series.length ?? 0;
    result.networkPoints = network?.series.length ?? 0;

    let mvrv: MVRVOutput | null = null;
    if (supply && supply.series.length >= 30 && quantConfigured) {
      const mvrvInput = supply.series
        .filter((p) => p.mvrv != null && Number.isFinite(p.mvrv))
        .map((p) => ({ timestamp: p.timestamp, mvrv: p.mvrv as number }));
      if (mvrvInput.length >= 30) {
        mvrv = await quantEngine.computeMVRV({
          asset,
          series: mvrvInput,
          lookback_days: LOOKBACK_DAYS,
        });
        result.mvrvComputed = mvrv != null;
      }
    }

    let flowRegime: FlowRegimeOutput | null = null;
    if (flows && flows.series.length >= 35 && quantConfigured) {
      flowRegime = await quantEngine.computeFlowRegime({
        asset,
        series: flows.series.map((p) => ({
          timestamp: p.timestamp,
          net_flow_usd: p.netFlowUsd,
        })),
      });
      result.flowRegimeComputed = flowRegime != null;
    }

    // Persist today's snapshot. OnChainSnapshot is keyed on (asset, timestamp).
    // Use the most-recent day across the series as the snapshot date.
    const latestSupply = supply?.series.at(-1);
    const latestFlow = flows?.series.at(-1);
    const latestNetwork = network?.series.at(-1);

    if (latestSupply) {
      const snapshotTs = new Date(latestSupply.timestamp);
      await prisma.onChainSnapshot.upsert({
        where: {
          asset_timestamp: { asset, timestamp: snapshotTs },
        },
        create: {
          asset,
          timestamp: snapshotTs,
          marketCapUsd: latestSupply.marketCapUsd,
          supplyNative: latestSupply.supplyNative,
          activeAddresses: latestNetwork?.activeAddresses ?? null,
          txCount: latestNetwork?.txCount ?? null,
          feesUsd: latestNetwork?.feesUsd ?? null,
          mvrv: mvrv?.current.mvrv ?? null,
          mvrvZScore: mvrv?.current.z_score ?? null,
          mvrvRegime: mvrv?.current.regime ?? null,
        },
        update: {
          marketCapUsd: latestSupply.marketCapUsd,
          supplyNative: latestSupply.supplyNative,
          activeAddresses: latestNetwork?.activeAddresses ?? null,
          txCount: latestNetwork?.txCount ?? null,
          feesUsd: latestNetwork?.feesUsd ?? null,
          mvrv: mvrv?.current.mvrv ?? null,
          mvrvZScore: mvrv?.current.z_score ?? null,
          mvrvRegime: mvrv?.current.regime ?? null,
        },
      });
      result.persistedSnapshots = 1;
    }

    if (latestFlow) {
      const flowTs = new Date(latestFlow.timestamp);
      await prisma.exchangeFlowSnapshot.upsert({
        where: {
          asset_exchange_timestamp: {
            asset,
            exchange: latestFlow.exchange,
            timestamp: flowTs,
          },
        },
        create: {
          asset,
          exchange: latestFlow.exchange,
          inflowUsd: latestFlow.inflowUsd,
          outflowUsd: latestFlow.outflowUsd,
          netFlowUsd: latestFlow.netFlowUsd,
          timestamp: flowTs,
        },
        update: {
          inflowUsd: latestFlow.inflowUsd,
          outflowUsd: latestFlow.outflowUsd,
          netFlowUsd: latestFlow.netFlowUsd,
        },
      });
      result.persistedFlows = 1;
    }

    // Warm Redis caches.
    if (supply && mvrv) {
      const overlay: OnChainSupplyResponse = {
        asset,
        mvrv,
        sopr: null,
        staleness: 'fresh',
        provider_configured: true,
        quant_engine_configured: true,
      };
      await setCached(`onchain:supply:${asset}`, overlay, SUPPLY_TTL);
    }

    if (flows) {
      const overlay: OnChainFlowsResponse = {
        asset,
        series: flows.series,
        regime: flowRegime,
        staleness: 'fresh',
        provider_configured: true,
        quant_engine_configured: quantConfigured,
      };
      await setCached(`onchain:flows:${asset}`, overlay, FLOWS_TTL);
    }

    if (network) {
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
      await setCached(`onchain:network:${asset}`, overlay, NETWORK_TTL);
    }
  } catch (err) {
    result.error = (err as Error).message;
  }

  return result;
}

async function refreshStablecoins(): Promise<StablecoinResult> {
  const result: StablecoinResult = {
    aggregateFetched: false,
    chartPoints: 0,
    persistedRow: false,
  };

  try {
    const provider = getStablecoinProvider();
    const [aggregate, chart] = await Promise.all([
      provider.fetchStablecoinAggregate(),
      provider.fetchStablecoinChart(),
    ]);

    if (!aggregate) return result;
    result.aggregateFetched = true;
    result.chartPoints = chart?.length ?? 0;

    const aggForCache: StablecoinAggregate = aggregate;
    const chartForCache: StablecoinChartPoint[] = chart ?? [];

    // Persist today's aggregate.
    const ts = new Date(aggregate.timestamp);
    // Truncate to day so upserts idempotent within a UTC day.
    ts.setUTCHours(0, 0, 0, 0);
    await prisma.stablecoinSnapshot.upsert({
      where: { timestamp: ts },
      create: {
        timestamp: ts,
        totalSupplyUsd: aggregate.totalSupplyUsd,
        exchangeBalanceUsd: aggregate.exchangeBalanceUsd ?? 0,
        exchangeBalancePct: aggregate.exchangeBalancePct ?? 0,
        usdtSupplyUsd: aggregate.usdtSupplyUsd,
        usdcSupplyUsd: aggregate.usdcSupplyUsd,
        daiSupplyUsd: aggregate.daiSupplyUsd,
      },
      update: {
        totalSupplyUsd: aggregate.totalSupplyUsd,
        usdtSupplyUsd: aggregate.usdtSupplyUsd,
        usdcSupplyUsd: aggregate.usdcSupplyUsd,
        daiSupplyUsd: aggregate.daiSupplyUsd,
      },
    });
    result.persistedRow = true;

    const overlay: OnChainStablecoinsResponse = {
      aggregate: aggForCache,
      chart: chartForCache,
      staleness: 'fresh',
      provider_configured: true,
    };
    await setCached('onchain:stablecoins', overlay, STABLECOIN_TTL);
  } catch (err) {
    result.error = (err as Error).message;
  }

  return result;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const assets: AssetResult[] = [];
  for (const asset of ASSETS) {
    assets.push(await refreshAsset(asset));
  }
  const stablecoins = await refreshStablecoins();
  const elapsedMs = Date.now() - startTs;

  return NextResponse.json({
    ok: true,
    assets,
    stablecoins,
    quantEngineConfigured: quantEngine.configured,
    elapsedMs,
  });
}
