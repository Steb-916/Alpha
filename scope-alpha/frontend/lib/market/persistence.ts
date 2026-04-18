/**
 * Historical market-data persistence helpers.
 *
 * Every write is idempotent via @@unique constraints on the underlying model —
 * safe to call multiple times with the same (asset, exchange, timestamp) tuple.
 * All helpers swallow errors and log them; they never throw, so the request
 * path that triggered persistence is never blocked by a DB hiccup.
 *
 * Timestamps are normalized at the call site:
 *   - Funding: exchange-provided funding-rate timestamp (ms since epoch)
 *   - OI: floored to the nearest hour so one row per hour per exchange
 *   - Liquidations: exchange-provided event time
 *   - Candles: exchange-provided candle open time
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';

export interface FundingSnapshotInput {
  asset: string;
  exchange: string;
  rate: number;
  markPrice: number;
  indexPrice: number;
  timestamp: Date;
}

export async function persistFundingSnapshot(
  input: FundingSnapshotInput,
): Promise<void> {
  try {
    await prisma.fundingRateSnapshot.upsert({
      where: {
        asset_exchange_timestamp: {
          asset: input.asset,
          exchange: input.exchange,
          timestamp: input.timestamp,
        },
      },
      create: {
        asset: input.asset,
        exchange: input.exchange,
        rate: input.rate,
        markPrice: input.markPrice,
        indexPrice: input.indexPrice,
        timestamp: input.timestamp,
      },
      update: {}, // Idempotent — do nothing if already exists
    });
  } catch (err) {
    log('warn', 'persistFundingSnapshot failed', {
      metadata: {
        asset: input.asset,
        exchange: input.exchange,
        error: (err as Error).message,
      },
    });
  }
}

export interface OISnapshotInput {
  asset: string;
  exchange: string;
  oi: number;
  oiUsd: number;
  price: number;
  /** Will be floored to the hour internally */
  timestamp: Date;
}

function floorToHour(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 3_600_000) * 3_600_000);
}

export async function persistOISnapshot(input: OISnapshotInput): Promise<void> {
  try {
    const ts = floorToHour(input.timestamp);
    await prisma.oISnapshot.upsert({
      where: {
        asset_exchange_timestamp: {
          asset: input.asset,
          exchange: input.exchange,
          timestamp: ts,
        },
      },
      create: {
        asset: input.asset,
        exchange: input.exchange,
        oi: input.oi,
        oiUsd: input.oiUsd,
        price: input.price,
        timestamp: ts,
      },
      update: {}, // Idempotent
    });
  } catch (err) {
    log('warn', 'persistOISnapshot failed', {
      metadata: {
        asset: input.asset,
        exchange: input.exchange,
        error: (err as Error).message,
      },
    });
  }
}

export interface LiquidationEventInput {
  asset: string;
  exchange: string;
  side: 'long' | 'short';
  quantity: number;
  price: number;
  usdValue: number;
  timestamp: Date;
}

export async function persistLiquidationEvents(
  events: LiquidationEventInput[],
): Promise<number> {
  if (events.length === 0) return 0;
  try {
    const result = await prisma.liquidationEvent.createMany({
      data: events,
    });
    return result.count;
  } catch (err) {
    log('warn', 'persistLiquidationEvents failed', {
      metadata: {
        count: events.length,
        error: (err as Error).message,
      },
    });
    return 0;
  }
}

export interface CandleHistoryInput {
  asset: string;
  exchange: string;
  timeframe: string; // "4h" | "1d"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export interface HealthSnapshotInput {
  asset: string;
  score: number;
  regime: string;
  funding: number;
  oi: number;
  liquidation: number;
  basis: number;
  /** Will be floored to the hour internally */
  timestamp: Date;
}

// ─── Phase 3: Options / volatility snapshots ──────────────────────────────

export interface OptionsChainSnapshotInput {
  asset: string;
  instrumentName: string;
  strike: number;
  expiration: Date;
  optionType: 'call' | 'put';
  markPrice: number;
  markIV: number;
  bidIV: number | null;
  askIV: number | null;
  underlyingPrice: number;
  openInterest: number;
  volume24h: number;
  delta: number | null;
  gamma: number | null;
  vega: number | null;
  theta: number | null;
  timestamp: Date;
}

/**
 * Bulk-persist options chain rows. Idempotent via
 * @@unique(asset, instrumentName, timestamp). Uses createMany with
 * skipDuplicates so a re-run in the same hour is a harmless no-op.
 */
export async function persistOptionsChainSnapshot(
  entries: OptionsChainSnapshotInput[],
): Promise<number> {
  if (entries.length === 0) return 0;
  try {
    const result = await prisma.optionsChainSnapshot.createMany({
      data: entries.map((e) => ({
        asset: e.asset,
        instrumentName: e.instrumentName,
        strike: e.strike,
        expiration: e.expiration,
        optionType: e.optionType,
        markPrice: e.markPrice,
        markIV: e.markIV,
        bidIV: e.bidIV,
        askIV: e.askIV,
        underlyingPrice: e.underlyingPrice,
        openInterest: e.openInterest,
        volume24h: e.volume24h,
        delta: e.delta,
        gamma: e.gamma,
        vega: e.vega,
        theta: e.theta,
        timestamp: floorToHour(e.timestamp),
      })),
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    log('warn', 'persistOptionsChainSnapshot failed', {
      metadata: {
        count: entries.length,
        error: (err as Error).message,
      },
    });
    return 0;
  }
}

export interface VolSurfaceSnapshotInput {
  asset: string;
  surfaceData: unknown; // Array of {strike, expiry, fittedIV, delta} — stored as JSON
  atmIV30d: number | null;
  atmIV90d: number | null;
  skew25d30d: number | null;
  timestamp: Date;
}

export async function persistVolSurfaceSnapshot(
  input: VolSurfaceSnapshotInput,
): Promise<void> {
  try {
    const ts = floorToHour(input.timestamp);
    await prisma.volSurfaceSnapshot.upsert({
      where: { asset_timestamp: { asset: input.asset, timestamp: ts } },
      create: {
        asset: input.asset,
        surfaceData: input.surfaceData as Prisma.InputJsonValue,
        atmIV30d: input.atmIV30d,
        atmIV90d: input.atmIV90d,
        skew25d30d: input.skew25d30d,
        timestamp: ts,
      },
      update: {
        surfaceData: input.surfaceData as Prisma.InputJsonValue,
        atmIV30d: input.atmIV30d,
        atmIV90d: input.atmIV90d,
        skew25d30d: input.skew25d30d,
      },
    });
  } catch (err) {
    log('warn', 'persistVolSurfaceSnapshot failed', {
      metadata: { asset: input.asset, error: (err as Error).message },
    });
  }
}

export interface IVSnapshotInput {
  asset: string;
  iv7d: number | null;
  iv30d: number | null;
  iv60d: number | null;
  iv90d: number | null;
  iv180d: number | null;
  skew25d7d: number | null;
  skew25d30d: number | null;
  skew25d90d: number | null;
  spotPrice: number;
  timestamp: Date;
}

export async function persistIVSnapshot(input: IVSnapshotInput): Promise<void> {
  try {
    const ts = floorToHour(input.timestamp);
    await prisma.iVSnapshot.upsert({
      where: { asset_timestamp: { asset: input.asset, timestamp: ts } },
      create: {
        asset: input.asset,
        iv7d: input.iv7d,
        iv30d: input.iv30d,
        iv60d: input.iv60d,
        iv90d: input.iv90d,
        iv180d: input.iv180d,
        skew25d7d: input.skew25d7d,
        skew25d30d: input.skew25d30d,
        skew25d90d: input.skew25d90d,
        spotPrice: input.spotPrice,
        timestamp: ts,
      },
      update: {
        iv7d: input.iv7d,
        iv30d: input.iv30d,
        iv60d: input.iv60d,
        iv90d: input.iv90d,
        iv180d: input.iv180d,
        skew25d7d: input.skew25d7d,
        skew25d30d: input.skew25d30d,
        skew25d90d: input.skew25d90d,
        spotPrice: input.spotPrice,
      },
    });
  } catch (err) {
    log('warn', 'persistIVSnapshot failed', {
      metadata: { asset: input.asset, error: (err as Error).message },
    });
  }
}

export async function persistHealthScoreSnapshot(
  input: HealthSnapshotInput,
): Promise<void> {
  try {
    const ts = floorToHour(input.timestamp);
    await prisma.healthScoreSnapshot.upsert({
      where: {
        asset_timestamp: {
          asset: input.asset,
          timestamp: ts,
        },
      },
      create: {
        asset: input.asset,
        score: input.score,
        regime: input.regime,
        funding: input.funding,
        oi: input.oi,
        liquidation: input.liquidation,
        basis: input.basis,
        timestamp: ts,
      },
      // Update on conflict so the hour's final reading is the latest one;
      // same-hour calls collapse to a single row with the most recent score.
      update: {
        score: input.score,
        regime: input.regime,
        funding: input.funding,
        oi: input.oi,
        liquidation: input.liquidation,
        basis: input.basis,
      },
    });
  } catch (err) {
    log('warn', 'persistHealthScoreSnapshot failed', {
      metadata: {
        asset: input.asset,
        error: (err as Error).message,
      },
    });
  }
}

// ─── Phase 4: Options Microstructure ─────────────────────────────────────────

export interface GreeksExposureSnapshotInput {
  asset: string;
  gexData: unknown; // GexStrike[] stored as JSON
  gammaFlip: number | null;
  totalNetGex: number;
  spotPrice: number;
  timestamp: Date;
}

export async function persistGreeksExposureSnapshot(
  input: GreeksExposureSnapshotInput,
): Promise<void> {
  try {
    const ts = floorToHour(input.timestamp);
    await prisma.greeksExposureSnapshot.upsert({
      where: { asset_timestamp: { asset: input.asset, timestamp: ts } },
      create: {
        asset: input.asset,
        gexData: input.gexData as Prisma.InputJsonValue,
        gammaFlip: input.gammaFlip,
        totalNetGex: input.totalNetGex,
        spotPrice: input.spotPrice,
        timestamp: ts,
      },
      update: {
        gexData: input.gexData as Prisma.InputJsonValue,
        gammaFlip: input.gammaFlip,
        totalNetGex: input.totalNetGex,
        spotPrice: input.spotPrice,
      },
    });
  } catch (err) {
    log('warn', 'persistGreeksExposureSnapshot failed', {
      metadata: { asset: input.asset, error: (err as Error).message },
    });
  }
}

export interface OptionsFlowEventInput {
  asset: string;
  instrumentName: string;
  expiration: Date;
  strike: number;
  optionType: 'call' | 'put';
  premiumUsd: number;
  size: number;
  unusualScore: number;
  timestamp: Date;
}

export async function persistOptionsFlowEvents(
  events: OptionsFlowEventInput[],
): Promise<number> {
  if (events.length === 0) return 0;
  try {
    const result = await prisma.optionsFlowEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
    return result.count;
  } catch (err) {
    log('warn', 'persistOptionsFlowEvents failed', {
      metadata: { count: events.length, error: (err as Error).message },
    });
    return 0;
  }
}

export async function persistCandleHistory(
  candles: CandleHistoryInput[],
): Promise<number> {
  if (candles.length === 0) return 0;
  let written = 0;
  // Prisma createMany + skipDuplicates needs the unique constraint to be the
  // default primary key on some databases; we use individual upserts here to
  // guarantee idempotency on the composite unique (asset, exchange, timeframe,
  // timestamp). Small batches (a few dozen at most) make this fine.
  for (const c of candles) {
    try {
      await prisma.candleHistory.upsert({
        where: {
          asset_exchange_timeframe_timestamp: {
            asset: c.asset,
            exchange: c.exchange,
            timeframe: c.timeframe,
            timestamp: c.timestamp,
          },
        },
        create: c,
        update: {
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        },
      });
      written++;
    } catch (err) {
      log('warn', 'persistCandleHistory row failed', {
        metadata: {
          asset: c.asset,
          exchange: c.exchange,
          timeframe: c.timeframe,
          error: (err as Error).message,
        },
      });
    }
  }
  return written;
}
