/**
 * Shared options data fetch-and-cache pipeline.
 *
 * This is the single source of truth for "fetch the Deribit options chain,
 * parse it, aggregate, cache, optionally dispatch to the Quant Engine, and
 * optionally persist snapshots to PostgreSQL". It's called from two places:
 *
 *   1. The refresh-options cron  — proactive, on schedule.
 *   2. Options API routes         — reactive, on cache miss (via warmChainCache).
 *
 * Fresh deploys, cold caches between cron runs, and silent cron failures
 * all self-heal the first time a user hits a route.
 *
 * Thundering-herd protection: warmChainCache takes a short-lived distributed
 * lock so 10 concurrent cold-cache requests trigger exactly one Deribit fetch.
 * The cron bypasses the lock (it runs on a schedule and is never a herd).
 */

import { prisma } from '@/lib/prisma';
import {
  setCached,
  writeFreshAndStale,
  tryAcquireLock,
  releaseLock,
} from '@/lib/cache/redis';
import { DeribitConnector } from '@/lib/exchanges/deribit';
import { parseBookSummaries } from '@/lib/options/chain-parser';
import { aggregateChain, type ChainAggregate } from '@/lib/options/aggregate';
import { computeGEX } from '@/lib/options/gex';
import { computeDEX } from '@/lib/options/dex';
import { computeVannaCharm } from '@/lib/options/vanna-charm';
import {
  persistOptionsChainSnapshot,
  persistVolSurfaceSnapshot,
  persistIVSnapshot,
  persistGEXSnapshot,
  type OptionsChainSnapshotInput,
} from '@/lib/market/persistence';
import { quantEngine } from '@/lib/quant-engine';
import type {
  DeribitCurrency,
  OptionsChainEntry,
} from '@/lib/exchanges/deribit-types';
import type {
  DEXOutput,
  GEXOutput,
  GreeksExposureOutput,
  RNDInput,
  RNDOutput,
  SkewInput,
  SkewOutput,
  VolConeInput,
  VolConeOutput,
  VolSurfaceInput,
  VolSurfaceOutput,
  VRPInput,
  VRPOutput,
} from '@/types/options';
import { getCached } from '@/lib/cache/redis';

// ─── Constants ──────────────────────────────────────────────────────────────

// Long TTL so the cache survives between daily-cron runs on Vercel Hobby.
// Routes read cache + stale first, so shorter TTLs would be safe on Pro.
const CACHE_TTL = 25 * 60 * 60; // 25 hours

// Lock TTL: long enough for a worst-case Deribit + full Quant Engine pass
// (~5-8s on a good day, much longer if the Quant Engine is slow), but short
// enough that a stuck fetcher doesn't permanently block warming.
const WARMING_LOCK_TTL = 30;

// Time a second waiter pauses before re-checking cache. Shorter than the
// lock TTL; long enough for a typical warm to finish.
const WARMING_WAIT_MS = 3000;

const deribit = new DeribitConnector();

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FetchOptions {
  /** Skip Quant Engine dispatch even when configured. Default: false. */
  skipQuantEngine?: boolean;
  /** Skip PostgreSQL snapshot writes. Default: false (cron persists). */
  skipPersistence?: boolean;
}

export interface FetchAndCacheResult {
  asset: DeribitCurrency;
  chain: OptionsChainEntry[];
  aggregate: ChainAggregate | null;
  volSurface: VolSurfaceOutput | null;
  skew: SkewOutput | null;
  volCone: VolConeOutput | null;
  vrp: VRPOutput | null;
  /** RND results keyed by expiry ISO date (YYYY-MM-DD). */
  rnd: Record<string, RNDOutput>;
  /** Phase 4 microstructure — computed in TypeScript from Deribit Greeks. */
  gex: GEXOutput | null;
  dex: DEXOutput | null;
  greeksExposure: GreeksExposureOutput | null;
  /** Metrics for the cron's response payload. */
  metrics: {
    instruments: number;
    persisted: number;
    quantCalls: Record<string, boolean>;
    lockSkipped?: boolean;
    error?: string;
  };
}

function emptyResult(
  asset: DeribitCurrency,
  error?: string,
  lockSkipped?: boolean,
): FetchAndCacheResult {
  return {
    asset,
    chain: [],
    aggregate: null,
    volSurface: null,
    skew: null,
    volCone: null,
    vrp: null,
    rnd: {},
    gex: null,
    dex: null,
    greeksExposure: null,
    metrics: {
      instruments: 0,
      persisted: 0,
      quantCalls: {},
      ...(error != null ? { error } : {}),
      ...(lockSkipped ? { lockSkipped: true } : {}),
    },
  };
}

// ─── Core fetch-and-cache pipeline ─────────────────────────────────────────

/**
 * Run the full fetch-parse-cache pipeline for one asset. No locking.
 *
 * Called by both the cron (directly, for scheduled refresh) and by the
 * locked wrappers below (for user-triggered on-demand warming).
 */
export async function fetchAndCacheOptionsData(
  asset: DeribitCurrency,
  opts: FetchOptions = {},
): Promise<FetchAndCacheResult> {
  const result = emptyResult(asset);

  try {
    // Step 1: Deribit (book summaries + historical volatility) in parallel
    const [summaries, volHistory] = await Promise.all([
      deribit.getBookSummary(asset),
      deribit.getHistoricalVolatility(asset).catch(() => []),
    ]);

    // Step 2: parse + drop illiquid
    const chain = parseBookSummaries(asset, summaries);
    result.chain = chain;
    result.metrics.instruments = chain.length;
    if (chain.length === 0) {
      result.metrics.error = 'empty chain';
      return result;
    }

    const aggregate = aggregateChain(asset, chain);
    result.aggregate = aggregate;

    // Step 3a: snapshot the previous chain before overwriting — the flow
    // scanner compares current vs previous to detect OI surges.
    const existingChain = await getCached<OptionsChainEntry[]>(
      `options:chain:${asset}`,
    );
    if (existingChain && Array.isArray(existingChain) && existingChain.length > 0) {
      await setCached(
        `options:chain:previous:${asset}`,
        existingChain,
        CACHE_TTL,
      );
    }

    // Step 3b: cache raw chain + aggregate (fresh + stale copies)
    await Promise.all([
      writeFreshAndStale(`options:chain:${asset}`, chain, CACHE_TTL),
      writeFreshAndStale(`options:aggregate:${asset}`, aggregate, CACHE_TTL),
    ]);

    // Step 3c: Phase 4 — compute GEX / DEX / vanna-charm in TypeScript
    // directly from the Deribit Greeks. These are not Quant-Engine-gated.
    const gex = computeGEX(asset, chain);
    result.gex = gex;
    if (gex) {
      await writeFreshAndStale(`options:gex:${asset}`, gex, CACHE_TTL);
    }
    const dex = computeDEX(asset, chain);
    result.dex = dex;
    if (dex) {
      await writeFreshAndStale(`options:dex:${asset}`, dex, CACHE_TTL);
    }
    const greeksExposure = computeVannaCharm(asset, chain);
    result.greeksExposure = greeksExposure;
    if (greeksExposure) {
      await writeFreshAndStale(
        `options:greeks-exposure:${asset}`,
        greeksExposure,
        CACHE_TTL,
      );
    }

    // Step 4: persist chain snapshot (idempotent bulk)
    const now = new Date();
    if (!opts.skipPersistence) {
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
      result.metrics.persisted = await persistOptionsChainSnapshot(
        persistInputs,
      );

      // Phase 4: persist hourly GEX snapshot for the over-time heatmap.
      if (gex) {
        await persistGEXSnapshot({
          asset,
          gammaFlip: gex.gamma_flip,
          totalGex: gex.total_gex,
          regime: gex.regime,
          callWall: gex.call_wall,
          putWall: gex.put_wall,
          levelsData: gex.levels,
          spotPrice: gex.spot_price,
          timestamp: now,
        });
      }
    }

    // Step 5: Quant Engine dispatch — bail if inert or caller opted out
    if (opts.skipQuantEngine || !quantEngine.configured) {
      return result;
    }

    // Shared inputs for all compute endpoints
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
      asset,
      spot_price: spotPrice,
      options: quantOptions,
      expirations,
    };
    const surface = await quantEngine.computeVolSurface(surfaceInput);
    result.metrics.quantCalls.volSurface = surface != null;
    if (surface) {
      result.volSurface = surface;
      await writeFreshAndStale(
        `options:vol-surface:${asset}`,
        surface,
        CACHE_TTL,
      );
      if (!opts.skipPersistence) {
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
          asset,
          surfaceData: surface.surface,
          atmIV30d: atm30,
          atmIV90d: atm90,
          skew25d30d: skew30,
          timestamp: now,
        });
      }
    }

    // 5b: skew + term structure
    const skewInput: SkewInput = {
      asset,
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
    result.metrics.quantCalls.skew = skew != null;
    if (skew) {
      result.skew = skew;
      await writeFreshAndStale(`options:skew:${asset}`, skew, CACHE_TTL);

      const atmAt = (days: number) =>
        skew.term_structure.find(
          (t) => Math.abs(t.expiry_days - days) <= (days <= 30 ? 7 : 14),
        )?.atm_iv ?? null;
      const skewAt = (days: number) =>
        skew.by_expiry.find(
          (b) => Math.abs(b.expiry_days - days) <= (days <= 30 ? 7 : 14),
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

      await setCached(`options:ivsnap:${asset}`, ivPayload, CACHE_TTL);

      if (!opts.skipPersistence) {
        await persistIVSnapshot({
          asset,
          ...ivPayload,
          timestamp: now,
        });
      }
    }

    // 5c: vol cone — needs daily closes from CandleHistory
    const dailyCloses = await prisma.candleHistory
      .findMany({
        where: {
          asset,
          exchange: 'binance',
          timeframe: '1d',
        },
        orderBy: { timestamp: 'desc' },
        take: 200,
      })
      .catch(() => [] as { close: number }[]);
    if (dailyCloses.length >= 8) {
      const atmIV30 =
        skew?.term_structure.find(
          (t) => Math.abs(t.expiry_days - 30) <= 7,
        )?.atm_iv ?? null;
      if (atmIV30 != null) {
        const coneInput: VolConeInput = {
          asset,
          daily_closes: dailyCloses.map((c) => c.close).reverse(),
          current_atm_iv: atmIV30,
        };
        const cone = await quantEngine.computeVolCone(coneInput);
        result.metrics.quantCalls.volCone = cone != null;
        if (cone) {
          result.volCone = cone;
          await writeFreshAndStale(
            `options:vol-cone:${asset}`,
            cone,
            CACHE_TTL,
          );
        }
      }
    }

    // 5d: VRP — needs IV + RV history
    const ivRows = await prisma.iVSnapshot
      .findMany({
        where: { asset },
        orderBy: { timestamp: 'asc' },
        take: 365,
      })
      .catch(() => [] as { timestamp: Date; iv30d: number | null }[]);
    if (ivRows.length >= 7 && volHistory.length > 0) {
      const vrpInput: VRPInput = {
        asset,
        iv_history: ivRows
          .filter((r) => r.iv30d != null)
          .map((r) => ({
            date: r.timestamp.toISOString().slice(0, 10),
            atm_iv_30d: r.iv30d as number,
          })),
        rv_history: volHistory.slice(-ivRows.length).map((p) => ({
          date: new Date(p.timestamp).toISOString().slice(0, 10),
          rv_30d: p.value,
        })),
      };
      const vrp = await quantEngine.computeVRP(vrpInput);
      result.metrics.quantCalls.vrp = vrp != null;
      if (vrp) {
        result.vrp = vrp;
        await writeFreshAndStale(`options:vrp:${asset}`, vrp, CACHE_TTL);
      }
    }

    // 5e: RND per expiration (up to 4 nearest; keeps latency bounded)
    const expiriesForRND = aggregate.expirations
      .filter((e) => e.daysToExpiry > 0 && e.daysToExpiry <= 120)
      .slice(0, 4);
    for (const exp of expiriesForRND) {
      const expChain = chain.filter(
        (c) =>
          c.expirationDate.getTime() === new Date(exp.expiration).getTime(),
      );
      if (expChain.length < 6) continue;
      const rndInput: RNDInput = {
        asset,
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
        const expKey = exp.expiration.slice(0, 10);
        result.rnd[expKey] = rnd;
        await setCached(`options:rnd:${asset}:${expKey}`, rnd, CACHE_TTL);
      }
    }

    // Per-endpoint success count
    const rndSucceeded = Object.keys(result.rnd).length;
    if (expiriesForRND.length > 0) {
      result.metrics.quantCalls.rnd = rndSucceeded > 0;
    }
  } catch (err) {
    result.metrics.error = (err as Error).message;
  }

  return result;
}

// ─── Locked wrapper for user-triggered warming ─────────────────────────────

/**
 * Warm the options cache on behalf of a user request. Acquires a short
 * distributed lock so concurrent cold-cache requests collapse to one
 * upstream fetch. If another warmer holds the lock, waits briefly and
 * returns an empty result — the caller should re-read cache (the in-flight
 * warmer will have populated it by then).
 *
 * Does NOT persist to PostgreSQL — the cron owns persistence. Does dispatch
 * to the Quant Engine when configured so compute-dependent tabs populate.
 */
export async function warmChainCache(
  asset: DeribitCurrency,
): Promise<FetchAndCacheResult> {
  const lockKey = `options:warming:${asset}`;
  const acquired = await tryAcquireLock(lockKey, WARMING_LOCK_TTL);

  if (!acquired) {
    await new Promise((r) => setTimeout(r, WARMING_WAIT_MS));
    return emptyResult(asset, undefined, true);
  }

  try {
    return await fetchAndCacheOptionsData(asset, {
      skipQuantEngine: false,
      skipPersistence: true,
    });
  } finally {
    await releaseLock(lockKey);
  }
}
