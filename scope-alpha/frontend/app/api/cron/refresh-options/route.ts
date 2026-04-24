/**
 * Cron-triggered Deribit options data refresh.
 *
 * GET /api/cron/refresh-options
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * For each of BTC + ETH:
 *   1. Fetch book summary + historical vol from Deribit (parallel).
 *   2. Parse into OptionsChainEntry[] and drop illiquid instruments.
 *   3. Cache raw chain + aggregated summary in Redis.
 *   4. Persist hourly chain snapshots to PostgreSQL (idempotent).
 *   5. If the Quant Engine is configured, dispatch compute calls
 *      (vol-surface, skew, vol-cone, VRP, RND per expiration) and cache +
 *      persist their outputs. When unset, the engine is in "inert mode" —
 *      chain data still flows and the compute caches stay empty.
 *   6. At the 02:00 UTC hour, run the retention cleanup once per day.
 *
 * Schedule: hourly (0 * * * *) per vercel.json. Hobby-compatible.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  setCached,
  writeFreshAndStale,
} from '@/lib/cache/redis';
import { DeribitConnector } from '@/lib/exchanges/deribit';
import {
  parseBookSummaries,
} from '@/lib/options/chain-parser';
import { aggregateChain } from '@/lib/options/aggregate';
import {
  persistOptionsChainSnapshot,
  persistVolSurfaceSnapshot,
  persistIVSnapshot,
  persistGreeksExposureSnapshot,
  persistOptionsFlowEvents,
  type OptionsChainSnapshotInput,
  type OptionsFlowEventInput,
} from '@/lib/market/persistence';
import { quantEngine } from '@/lib/quant-engine';
import { computeGexByStrike, computeDexByStrike, computeVannaCharm } from '@/lib/options/greeks-exposure';
import { computeMaxPainPinRisk } from '@/lib/options/pin-risk';
import { computeFlowFromChainDelta } from '@/lib/options/flow-scanner';
import type {
  DeribitCurrency,
  OptionsChainEntry,
} from '@/lib/exchanges/deribit-types';
import type {
  RNDInput,
  SkewInput,
  VolConeInput,
  VolSurfaceInput,
  VRPInput,
} from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS: DeribitCurrency[] = ['BTC', 'ETH'];
// Vercel Hobby plans only support daily crons, so the cache TTL is set
// slightly longer than the daily cron interval (25h) to ensure the cache
// never blanks between runs. Pro plans can reduce both cron frequency and
// this TTL if fresher data is wanted; all routes read cache + stale so
// lowering this is safe.
const CACHE_TTL = 25 * 60 * 60; // 25 hours

const deribit = new DeribitConnector();

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

interface AssetResult {
  asset: string;
  instruments: number;
  persisted: number;
  quantCalls: Record<string, boolean>;
  error?: string;
}

async function processAsset(currency: DeribitCurrency): Promise<AssetResult> {
  const result: AssetResult = {
    asset: currency,
    instruments: 0,
    persisted: 0,
    quantCalls: {},
  };

  const now = new Date();

  try {
    // Step 1: fetch from Deribit in parallel
    const [summaries, volHistory] = await Promise.all([
      deribit.getBookSummary(currency),
      deribit.getHistoricalVolatility(currency).catch(() => []),
    ]);

    // Step 2: parse + filter
    const chain = parseBookSummaries(currency, summaries);
    result.instruments = chain.length;
    if (chain.length === 0) {
      result.error = 'empty chain';
      return result;
    }

    const aggregate = aggregateChain(currency, chain);

    // Step 3: cache raw chain + aggregate
    await Promise.all([
      writeFreshAndStale(`options:chain:${currency}`, chain, CACHE_TTL),
      writeFreshAndStale(`options:aggregate:${currency}`, aggregate, CACHE_TTL),
    ]);

    // Step 3b: Compute GEX / DEX / Vanna-Charm from BS model and cache
    const gex = computeGexByStrike(chain);
    const dex = computeDexByStrike(chain);
    const vannaCharm = computeVannaCharm(chain);
    await Promise.all([
      writeFreshAndStale(`options:gex:${currency}`, gex, CACHE_TTL),
      writeFreshAndStale(`options:dex:${currency}`, dex, CACHE_TTL),
      writeFreshAndStale(`options:vanna-charm:${currency}`, vannaCharm, CACHE_TTL),
    ]);

    // Step 3c: Max Pain / Pin Risk
    const maxPainPinRisk = computeMaxPainPinRisk(chain);
    await writeFreshAndStale(
      `options:max-pain-pin-risk:${currency}`,
      maxPainPinRisk,
      CACHE_TTL,
    );

    // Step 3d: Persist GEX snapshot for heatmap history
    await persistGreeksExposureSnapshot({
      asset: currency,
      gexData: gex.strikes,
      gammaFlip: gex.gammaFlip,
      totalNetGex: gex.totalNetGex,
      spotPrice: gex.spot,
      timestamp: now,
    });

    // Step 3e: Options flow — diff against last hourly DB snapshot
    const prevSnapshotRows = await prisma.optionsChainSnapshot
      .findMany({
        where: { asset: currency, timestamp: { lt: now } },
        orderBy: { timestamp: 'desc' },
        take: 1000,
      })
      .catch(() => []);

    if (prevSnapshotRows.length > 0) {
      const prevChain: OptionsChainEntry[] = prevSnapshotRows.map((r) => ({
        asset: r.asset,
        instrumentName: r.instrumentName,
        strike: r.strike,
        expirationDate: new Date(r.expiration),
        daysToExpiry: Math.round(
          (new Date(r.expiration).getTime() - now.getTime()) / 86_400_000,
        ),
        optionType: r.optionType as 'call' | 'put',
        markPrice: r.markPrice,
        markIV: r.markIV,
        bidIV: r.bidIV,
        askIV: r.askIV,
        underlyingPrice: r.underlyingPrice,
        openInterest: r.openInterest,
        volume24h: r.volume24h,
        delta: r.delta,
        gamma: r.gamma,
        vega: r.vega,
        theta: r.theta,
      }));

      const flow = computeFlowFromChainDelta(chain, prevChain);
      await writeFreshAndStale(`options:flow:${currency}`, flow, CACHE_TTL);

      // Persist events with unusualScore > 30
      const unusualEvents: OptionsFlowEventInput[] = flow.events
        .filter((e) => e.unusualScore > 30)
        .map((e) => ({
          asset: currency,
          instrumentName: e.instrumentName,
          expiration: new Date(e.expiration),
          strike: e.strike,
          optionType: e.optionType,
          premiumUsd: e.premiumUsd,
          size: e.size,
          unusualScore: e.unusualScore,
          timestamp: now,
        }));
      if (unusualEvents.length > 0) {
        await persistOptionsFlowEvents(unusualEvents);
      }
    }

    // Step 4: persist chain snapshot (bulk, idempotent)
    const persistInputs: OptionsChainSnapshotInput[] = chain.map((c) => ({
      asset: c.asset,
      instrumentName: c.instrumentName,
      strike: c.strike,
      expiration: c.expirationDate,
      optionType: c.optionType,
      markPrice: c.markPrice,
      markIV: c.markIV,
      bidIV: c.bidIV,
      askIV: c.askIV,
      underlyingPrice: c.underlyingPrice,
      openInterest: c.openInterest,
      volume24h: c.volume24h,
      delta: c.delta,
      gamma: c.gamma,
      vega: c.vega,
      theta: c.theta,
      timestamp: now,
    }));
    result.persisted = await persistOptionsChainSnapshot(persistInputs);

    // Step 5: Quant Engine — skip block entirely when inert
    if (!quantEngine.configured) {
      return result;
    }

    // Build shared inputs once
    const expirations = aggregate.expirations.map((e) => ({
      date: e.expiration,
      days_to_expiry: e.daysToExpiry,
    }));
    const quantOptions = chain.map((c) => ({
      strike: c.strike,
      expiry_days: c.daysToExpiry,
      option_type: c.optionType,
      mark_iv: c.markIV,
      bid_iv: c.bidIV,
      ask_iv: c.askIV,
      open_interest: c.openInterest,
      volume_24h: c.volume24h,
    }));
    const spotPrice = chain[0].underlyingPrice;

    // 5a: vol-surface
    const surfaceInput: VolSurfaceInput = {
      asset: currency,
      spot_price: spotPrice,
      options: quantOptions,
      expirations,
    };
    const surface = await quantEngine.computeVolSurface(surfaceInput);
    result.quantCalls.volSurface = surface != null;
    if (surface) {
      await writeFreshAndStale(
        `options:vol-surface:${currency}`,
        surface,
        CACHE_TTL,
      );
      const atm30 =
        surface.summary.atm_iv_by_expiry.find(
          (x) => Math.abs(x.expiry_days - 30) <= 7,
        )?.atm_iv ?? null;
      const atm90 =
        surface.summary.atm_iv_by_expiry.find(
          (x) => Math.abs(x.expiry_days - 90) <= 14,
        )?.atm_iv ?? null;
      const skew30 =
        surface.summary.skew_25d_by_expiry.find(
          (x) => Math.abs(x.expiry_days - 30) <= 7,
        )?.skew_25d ?? null;

      await persistVolSurfaceSnapshot({
        asset: currency,
        surfaceData: surface.surface,
        atmIV30d: atm30,
        atmIV90d: atm90,
        skew25d30d: skew30,
        timestamp: now,
      });
    }

    // 5b: skew + term structure (single endpoint)
    const skewInput: SkewInput = {
      asset: currency,
      spot_price: spotPrice,
      options: quantOptions.map((q) => ({
        strike: q.strike,
        expiry_days: q.expiry_days,
        option_type: q.option_type,
        mark_iv: q.mark_iv,
        open_interest: q.open_interest,
      })),
    };
    const skew = await quantEngine.computeSkew(skewInput);
    result.quantCalls.skew = skew != null;
    if (skew) {
      await writeFreshAndStale(`options:skew:${currency}`, skew, CACHE_TTL);

      // Persist ATM IV snapshot at standard tenors from term structure
      const atmAt = (days: number) =>
        skew.term_structure.find(
          (t) => Math.abs(t.expiry_days - days) <=
            (days <= 30 ? 7 : 14),
        )?.atm_iv ?? null;
      const skewAt = (days: number) =>
        skew.by_expiry.find(
          (b) => Math.abs(b.expiry_days - days) <=
            (days <= 30 ? 7 : 14),
        )?.skew_25d ?? null;

      const ivPayload = {
        iv7d: atmAt(7),
        iv30d: atmAt(30),
        iv60d: atmAt(60),
        iv90d: atmAt(90),
        iv180d: atmAt(180),
        skew25d7d: skewAt(7),
        skew25d30d: skewAt(30),
        skew25d90d: skewAt(90),
        spotPrice,
      };

      // Cache flat IV snapshot for the refresh-screener cron to consume.
      await setCached(`options:ivsnap:${currency}`, ivPayload, CACHE_TTL);

      await persistIVSnapshot({
        asset: currency,
        ...ivPayload,
        timestamp: now,
      });
    }

    // 5c: vol cone — needs daily closes from CandleHistory
    const dailyCloses = await prisma.candleHistory
      .findMany({
        where: {
          asset: currency,
          exchange: 'binance',
          timeframe: '1d',
        },
        orderBy: { timestamp: 'desc' },
        take: 200,
      })
      .catch(() => []);
    if (dailyCloses.length >= 8) {
      const atmIV30 =
        skew?.term_structure.find(
          (t) => Math.abs(t.expiry_days - 30) <= 7,
        )?.atm_iv ?? null;
      if (atmIV30 != null) {
        const coneInput: VolConeInput = {
          asset: currency,
          daily_closes: dailyCloses
            .map((c) => c.close)
            .reverse(),
          current_atm_iv: atmIV30,
        };
        const cone = await quantEngine.computeVolCone(coneInput);
        result.quantCalls.volCone = cone != null;
        if (cone) {
          await writeFreshAndStale(
            `options:vol-cone:${currency}`,
            cone,
            CACHE_TTL,
          );
        }
      }
    }

    // 5d: VRP — needs IV + RV history
    const ivRows = await prisma.iVSnapshot
      .findMany({
        where: { asset: currency },
        orderBy: { timestamp: 'asc' },
        take: 365,
      })
      .catch(() => []);
    if (ivRows.length >= 7 && volHistory.length > 0) {
      const vrpInput: VRPInput = {
        asset: currency,
        iv_history: ivRows
          .filter((r) => r.iv30d != null)
          .map((r) => ({
            date: r.timestamp.toISOString().slice(0, 10),
            atm_iv_30d: r.iv30d as number,
          })),
        rv_history: volHistory
          .slice(-ivRows.length)
          .map((p) => ({
            date: new Date(p.timestamp).toISOString().slice(0, 10),
            rv_30d: p.value,
          })),
      };
      const vrp = await quantEngine.computeVRP(vrpInput);
      result.quantCalls.vrp = vrp != null;
      if (vrp) {
        await writeFreshAndStale(
          `options:vrp:${currency}`,
          vrp,
          CACHE_TTL,
        );
      }
    }

    // 5e: RND per expiration (only up to 4 nearest expirations to control
    // latency)
    const expiriesForRND = aggregate.expirations
      .filter((e) => e.daysToExpiry > 0 && e.daysToExpiry <= 120)
      .slice(0, 4);
    for (const exp of expiriesForRND) {
      const expChain = chain.filter(
        (c) => c.expirationDate.getTime() === new Date(exp.expiration).getTime(),
      );
      if (expChain.length < 6) continue;
      const rndInput: RNDInput = {
        asset: currency,
        spot_price: spotPrice,
        expiry_date: exp.expiration,
        expiry_days: exp.daysToExpiry,
        risk_free_rate: 0.05,
        options: expChain.map((c) => ({
          strike: c.strike,
          call_price_usd: c.markPrice,
          iv: c.markIV,
          option_type: c.optionType,
        })),
      };
      const rnd = await quantEngine.computeRND(rndInput);
      if (rnd) {
        await setCached(
          `options:rnd:${currency}:${exp.expiration.slice(0, 10)}`,
          rnd,
          CACHE_TTL,
        );
      }
    }
  } catch (err) {
    result.error = (err as Error).message;
  }
  return result;
}

async function runRetention(): Promise<{ deleted: number }> {
  try {
    // Hourly snapshots older than 30 days except noon UTC
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deletedHourly = await prisma.$executeRaw`
      DELETE FROM "OptionsChainSnapshot"
      WHERE "timestamp" < ${thirtyDaysAgo}
      AND EXTRACT(HOUR FROM "timestamp") != 12
    `;
    // Any snapshot older than 1 year
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const deletedOld = await prisma.$executeRaw`
      DELETE FROM "OptionsChainSnapshot"
      WHERE "timestamp" < ${yearAgo}
    `;
    return { deleted: Number(deletedHourly) + Number(deletedOld) };
  } catch (err) {
    console.warn('[refresh-options] retention failed:', (err as Error).message);
    return { deleted: 0 };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const results: AssetResult[] = [];
  for (const asset of ASSETS) {
    results.push(await processAsset(asset));
  }

  let retention: { deleted: number } | null = null;
  if (new Date().getUTCHours() === 2) {
    retention = await runRetention();
  }

  const elapsedMs = Date.now() - startTs;
  return NextResponse.json({
    ok: true,
    assets: results,
    quantEngineConfigured: quantEngine.configured,
    retention,
    elapsedMs,
  });
}
