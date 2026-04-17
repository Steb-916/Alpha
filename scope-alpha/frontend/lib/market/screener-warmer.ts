/**
 * Shared screener cache warmer.
 *
 * Builds the multi-asset ScreenerRow[] envelope and writes it to Redis.
 * Called by:
 *   1. /api/cron/refresh-screener — proactive, on schedule.
 *   2. /api/market/screener       — reactive, on cold cache.
 *
 * Warming is expensive (fans out ~6 REST calls per asset, batches of 5 in
 * parallel). For a typical ENABLED_ASSETS list of 10–15 assets, a cold warm
 * takes 10–15 seconds. The lock prevents concurrent user requests from all
 * triggering simultaneous warms.
 */

import { ENABLED_ASSETS, type AssetConfig } from '@/config/assets';
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
import {
  getCached,
  setCached,
  writeFreshAndStale,
  tryAcquireLock,
  releaseLock,
} from '@/lib/cache/redis';
import { persistHealthScoreSnapshot } from '@/lib/market/persistence';
import { runAlertsForAsset } from '@/lib/alerts/runner';
import { BinanceConnector } from '@/lib/exchanges/binance';
import { computeCVD, cvdTrendLabel } from '@/lib/analytics/cvd';
import {
  buildFundingOpportunity,
  fundingFromData,
} from '@/lib/analytics/arb-scanner';
import type {
  BasisData,
  FundingData,
  OpenInterestData,
  ScreenerRow,
} from '@/lib/types';

export const SCREENER_KEY = 'market:screener';
// 25h TTLs keep the warm cache alive between daily crons on Vercel Hobby.
const SCREENER_TTL = 25 * 60 * 60;
const SPARKLINE_TTL = 25 * 60 * 60;
const PER_METRIC_TTL = 25 * 60 * 60;

const WARMING_LOCK_KEY = 'screener:warming';
const WARMING_LOCK_TTL = 60; // screener is slower than options; allow longer hold
const WARMING_WAIT_MS = 4000; // waiters poll cache after this delay

const binance = new BinanceConnector();

export interface ScreenerEnvelope {
  rows: ScreenerRow[];
  _cachedAt?: number;
  count: number;
  errors: string[];
}

export interface WarmScreenerOptions {
  /** Use the distributed lock (for user-triggered warm paths). Default: false (cron). */
  useLock?: boolean;
  /** Skip alert evaluation. Default: false. */
  skipAlerts?: boolean;
  /** Skip HealthScoreSnapshot persistence. Default: false. */
  skipPersistence?: boolean;
}

export interface WarmScreenerResult {
  envelope: ScreenerEnvelope | null;
  elapsedMs: number;
  lockSkipped?: boolean;
}

async function buildSparkline(asset: AssetConfig): Promise<number[]> {
  try {
    const klines = await binance.getKlines(asset.binance, '1h', 24);
    return klines.map((k) => k.close);
  } catch (err) {
    console.warn(
      `[screener-warmer] sparkline fetch failed for ${asset.symbol}:`,
      (err as Error).message,
    );
    return [];
  }
}

async function buildRow(
  asset: AssetConfig,
  opts: WarmScreenerOptions,
): Promise<{ row: ScreenerRow | null; error?: string }> {
  const [
    fundingRes,
    oiRes,
    basisRes,
    sparklineRes,
    tickerRes,
    liqRes,
  ] = await Promise.allSettled([
    aggregateFunding(asset.symbol),
    aggregateOI(asset.symbol),
    aggregateBasis(asset.symbol),
    buildSparkline(asset),
    binance.get24hrTicker(asset.binance),
    getCached<LiqSnapshot>(LIQ_SNAPSHOT_KEY(asset.binance)),
  ]);

  const funding: FundingData | null =
    fundingRes.status === 'fulfilled' ? fundingRes.value : null;
  const oi: OpenInterestData | null =
    oiRes.status === 'fulfilled' ? oiRes.value : null;
  const basis: BasisData | null =
    basisRes.status === 'fulfilled' ? basisRes.value : null;
  const sparkline =
    sparklineRes.status === 'fulfilled' ? sparklineRes.value : [];
  const tickers = tickerRes.status === 'fulfilled' ? tickerRes.value : [];
  const liqSnap = liqRes.status === 'fulfilled' ? liqRes.value : null;

  const ticker = tickers.find((t) => t.symbol === asset.binance) || tickers[0];

  if (!funding && !oi && !ticker) {
    return { row: null, error: `${asset.symbol}: all data fetches failed` };
  }

  const writes: Promise<unknown>[] = [];
  if (funding) {
    writes.push(
      writeFreshAndStale(`market:funding:${asset.symbol}`, funding, PER_METRIC_TTL),
    );
  }
  if (oi) {
    writes.push(
      writeFreshAndStale(`market:oi:${asset.symbol}`, oi, PER_METRIC_TTL),
    );
  }
  if (basis) {
    writes.push(
      writeFreshAndStale(`market:basis:${asset.symbol}`, basis, PER_METRIC_TTL),
    );
  }
  if (sparkline.length) {
    writes.push(
      setCached(`market:sparkline:${asset.symbol}`, sparkline, SPARKLINE_TTL),
    );
  }
  await Promise.allSettled(writes);

  const health = computeHealthScore({
    symbol: asset.symbol,
    funding,
    oi,
    basis,
    liquidation: liqSnap,
  });

  await writeFreshAndStale(
    `market:health:${asset.symbol}`,
    health,
    PER_METRIC_TTL,
  );

  if (!opts.skipPersistence) {
    void persistHealthScoreSnapshot({
      asset: asset.symbol,
      score: health.score,
      regime: health.regimeV2 ?? health.regime,
      funding: health.components.funding,
      oi: health.components.oi,
      liquidation: health.components.liquidation,
      basis: health.components.basis,
      timestamp: new Date(),
    });
  }

  // Phase 3 options context — BTC/ETH only
  let iv30d: number | undefined;
  let skew25d: number | undefined;
  let vrp: number | undefined;
  let volRegime: 'low' | 'normal' | 'high' | 'extreme' | undefined;
  if (asset.symbol === 'BTC' || asset.symbol === 'ETH') {
    type IVCache = {
      iv30d: number | null;
      skew25d30d: number | null;
    };
    const ivSnap = await getCached<IVCache>(
      `options:ivsnap:${asset.symbol}`,
    );
    if (ivSnap?.iv30d != null) iv30d = ivSnap.iv30d;
    if (ivSnap?.skew25d30d != null) skew25d = ivSnap.skew25d30d;

    type VRPCache = { current_vrp: number };
    const vrpCache = await getCached<VRPCache>(`options:vrp:${asset.symbol}`);
    if (vrpCache?.current_vrp != null) vrp = vrpCache.current_vrp;

    type VolConeCache = { current_atm_iv: number; iv_percentile_vs_rv30d: number };
    const coneCache = await getCached<VolConeCache>(
      `options:vol-cone:${asset.symbol}`,
    );
    if (coneCache?.iv_percentile_vs_rv30d != null) {
      const pct = coneCache.iv_percentile_vs_rv30d;
      if (pct < 25) volRegime = 'low';
      else if (pct < 60) volRegime = 'normal';
      else if (pct < 85) volRegime = 'high';
      else volRegime = 'extreme';
    }
  }

  // Phase 4 — pull GEX + flow + pin-risk context so the corresponding
  // alert types can fire. BTC/ETH only, read-through cache only.
  let gammaFlip: number | undefined;
  let gammaRegime: 'positive_gamma' | 'negative_gamma' | undefined;
  let flowAnomalyScore: number | undefined;
  let pinRiskMax: number | undefined;
  if (asset.symbol === 'BTC' || asset.symbol === 'ETH') {
    type GEXCache = {
      gamma_flip: number;
      regime: 'positive_gamma' | 'negative_gamma';
    };
    const gexCache = await getCached<GEXCache>(`options:gex:${asset.symbol}`);
    if (gexCache) {
      gammaFlip = gexCache.gamma_flip;
      gammaRegime = gexCache.regime;
    }
    type FlowCache = {
      anomalies: Array<{ significance: 'low' | 'medium' | 'high' }>;
    };
    const flowCache = await getCached<FlowCache>(
      `options:flow:${asset.symbol}`,
    );
    if (flowCache?.anomalies && flowCache.anomalies.length > 0) {
      const topSig = flowCache.anomalies[0].significance;
      flowAnomalyScore = topSig === 'high' ? 1 : topSig === 'medium' ? 0.5 : 0.2;
    }
  }

  if (!opts.skipAlerts) {
    void runAlertsForAsset(asset.symbol, {
      funding,
      oi,
      basis,
      liquidation: liqSnap,
      health,
      ticker: ticker ? { lastPrice: ticker.lastPrice } : null,
      iv30d,
      skew25d,
      vrp,
      gammaFlip,
      gammaRegime,
      flowAnomalyScore,
      pinRiskMax,
    });
  }

  const liq24h = liqSnap ? liqSnap.longUsd + liqSnap.shortUsd : 0;
  const liqRatio =
    liqSnap && liqSnap.shortUsd > 0 ? liqSnap.longUsd / liqSnap.shortUsd : 0;

  let cvdTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  try {
    const klines = await binance.getKlines(asset.binance, '1h', 24);
    const cvdSeries = computeCVD(klines);
    cvdTrend = cvdTrendLabel(cvdSeries);
  } catch {
    /* skip */
  }

  let arbYield: number | undefined;
  if (funding) {
    const rates = fundingFromData(funding);
    if (rates.binance != null && rates.bybit != null) {
      const op = buildFundingOpportunity({
        asset: asset.symbol,
        binanceRate: rates.binance,
        bybitRate: rates.bybit,
        history: [],
      });
      if (op) arbYield = op.netYieldAfterFees;
    }
  }

  const row: ScreenerRow = {
    symbol: asset.symbol,
    name: asset.name,
    price: ticker?.lastPrice ?? 0,
    marketCap: 0,
    volume24h: ticker?.volume24h ?? 0,
    change24h: ticker?.priceChangePercent24h ?? 0,
    change7d: 0,
    rank: asset.rank,
    sparkline,
    fundingRate: funding?.currentRate ?? 0,
    fundingZ: funding?.zScore ?? 0,
    oi: oi?.aggregateOI ?? 0,
    oiChange24h: oi?.change24h ?? 0,
    liq24h,
    liqRatio,
    basis: basis?.currentBasis ?? 0,
    healthScore: health.score,
    regime: health.regime,
    regimeV2: health.regimeV2,
    cvdTrend,
    arbYield,
    atmIV30d: iv30d,
    skew25d,
    volRegime,
  };

  return { row };
}

async function runWarm(
  opts: WarmScreenerOptions,
): Promise<WarmScreenerResult> {
  const startTs = Date.now();
  const errors: string[] = [];
  const rows: ScreenerRow[] = [];

  const BATCH_SIZE = 5;
  for (let i = 0; i < ENABLED_ASSETS.length; i += BATCH_SIZE) {
    const batch = ENABLED_ASSETS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((a) => buildRow(a, opts)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.row) rows.push(r.value.row);
        if (r.value.error) errors.push(r.value.error);
      } else {
        errors.push(String(r.reason));
      }
    }
  }

  rows.sort((a, b) => a.rank - b.rank);

  const envelope: ScreenerEnvelope = {
    rows,
    count: rows.length,
    errors,
  };

  await writeFreshAndStale(SCREENER_KEY, envelope, SCREENER_TTL);
  return { envelope, elapsedMs: Date.now() - startTs };
}

/**
 * Warm the screener cache. When `useLock` is true, concurrent callers
 * collapse to one fetch — late arrivals wait ~4s and receive a lockSkipped
 * result; the caller should re-read the cache (which the lock holder has
 * populated by then).
 */
export async function warmScreenerCache(
  opts: WarmScreenerOptions = {},
): Promise<WarmScreenerResult> {
  if (!opts.useLock) {
    return runWarm(opts);
  }
  const acquired = await tryAcquireLock(WARMING_LOCK_KEY, WARMING_LOCK_TTL);
  if (!acquired) {
    await new Promise((r) => setTimeout(r, WARMING_WAIT_MS));
    return { envelope: null, elapsedMs: WARMING_WAIT_MS, lockSkipped: true };
  }
  try {
    return await runWarm(opts);
  } finally {
    await releaseLock(WARMING_LOCK_KEY);
  }
}
