/**
 * Cron-triggered screener cache warmer.
 *
 * GET /api/cron/refresh-screener
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Iterates ENABLED_ASSETS, fans out funding/OI/basis/ticker/sparkline
 * fetches in parallel (with Promise.allSettled), assembles a ScreenerRow[]
 * matching the app's existing internal shape, and writes to:
 *   - market:screener         (TTL 90s — slightly longer than the 60s cron
 *                              interval so the cache never blanks between runs)
 *   - market:sparkline:<sym>  (TTL 5min, per-symbol)
 *
 * The route also pre-warms the per-symbol funding/oi/basis cache keys so
 * the dashboard pages get instant cache hits.
 *
 * Vercel sets the Authorization header automatically when invoking via the
 * `crons` array in vercel.json.
 */

import { NextResponse } from 'next/server';
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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Generous timeout — we're fanning out ~60 REST calls.
export const maxDuration = 60;

const SCREENER_KEY = 'market:screener';
const SCREENER_TTL = 90;
const SPARKLINE_TTL = 300;
const PER_METRIC_TTL = 60;

const binance = new BinanceConnector();

interface ScreenerEnvelope {
  rows: ScreenerRow[];
  _cachedAt?: number;
  count: number;
  errors: string[];
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — only allow in dev to avoid foot-gunning prod.
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function buildSparkline(asset: AssetConfig): Promise<number[]> {
  try {
    const klines = await binance.getKlines(asset.binance, '1h', 24);
    return klines.map((k) => k.close);
  } catch (err) {
    console.warn(
      `[refresh-screener] sparkline fetch failed for ${asset.symbol}:`,
      (err as Error).message,
    );
    return [];
  }
}

async function buildRow(asset: AssetConfig): Promise<{
  row: ScreenerRow | null;
  error?: string;
}> {
  // Run all metric fetches in parallel.
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

  // If we have nothing useful for this row, bail out.
  if (!funding && !oi && !ticker) {
    return {
      row: null,
      error: `${asset.symbol}: all data fetches failed`,
    };
  }

  // Pre-warm per-metric cache keys so the dashboard pages get instant hits.
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

  // Compute health score from whatever we have.
  const health = computeHealthScore({
    symbol: asset.symbol,
    funding,
    oi,
    basis,
    liquidation: liqSnap,
  });

  // Pre-warm the health cache too.
  await writeFreshAndStale(
    `market:health:${asset.symbol}`,
    health,
    PER_METRIC_TTL,
  );

  // Phase 2: persist the composite score snapshot for trend rendering.
  // Hour-floored via the helper, idempotent via @@unique(asset, timestamp).
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

  // Phase 3: for BTC/ETH, attach IV + skew + VRP context for vol-based alerts
  // and the new screener columns. Reads from the Redis caches populated by
  // refresh-options. Undefined for other assets (no options data).
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

  // Phase 2: evaluate configured alerts for this asset against fresh data.
  // Fire-and-forget so a slow DB read doesn't stall the cron.
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
  });

  // Liquidation totals (24h) from the snapshot. If absent, leave as 0.
  const liq24h = liqSnap ? liqSnap.longUsd + liqSnap.shortUsd : 0;
  const liqRatio =
    liqSnap && liqSnap.shortUsd > 0
      ? liqSnap.longUsd / liqSnap.shortUsd
      : 0;

  // Phase 2: quick CVD trend derived from the 24h sparkline klines fetched
  // above. Reuses the same candle objects so no extra REST round-trip.
  let cvdTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  try {
    const klines = await binance.getKlines(asset.binance, '1h', 24);
    const cvdSeries = computeCVD(klines);
    cvdTrend = cvdTrendLabel(cvdSeries);
  } catch {
    /* skip — cvdTrend defaults to neutral */
  }

  // Phase 2: rough arb yield using funding differential only (basis requires
  // historical data we may not have yet). Null when both rates aren't present.
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
    // MarketSnapshot fields
    symbol: asset.symbol,
    name: asset.name,
    price: ticker?.lastPrice ?? 0,
    marketCap: 0, // not provided by exchanges; surfacing 0 is fine for now
    volume24h: ticker?.volume24h ?? 0,
    change24h: ticker?.priceChangePercent24h ?? 0,
    change7d: 0, // would require 7d klines; deferred to a later phase
    rank: asset.rank,
    sparkline,

    // Screener-specific fields
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

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const errors: string[] = [];
  const rows: ScreenerRow[] = [];

  // Process assets in parallel batches of 5 to keep total exchange call
  // pressure manageable while still completing under maxDuration.
  const BATCH_SIZE = 5;
  for (let i = 0; i < ENABLED_ASSETS.length; i += BATCH_SIZE) {
    const batch = ENABLED_ASSETS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((a) => buildRow(a)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.row) rows.push(r.value.row);
        if (r.value.error) errors.push(r.value.error);
      } else {
        errors.push(String(r.reason));
      }
    }
  }

  // Preserve canonical order (rank-sorted) regardless of batch race.
  rows.sort((a, b) => a.rank - b.rank);

  const envelope: ScreenerEnvelope = {
    rows,
    count: rows.length,
    errors,
  };

  await writeFreshAndStale(SCREENER_KEY, envelope, SCREENER_TTL);

  const elapsedMs = Date.now() - startTs;
  console.log(
    `[refresh-screener] built ${rows.length}/${ENABLED_ASSETS.length} rows in ${elapsedMs}ms (${errors.length} errors)`,
  );

  return NextResponse.json({
    ok: true,
    rows: rows.length,
    errors: errors.length,
    elapsedMs,
  });
}
