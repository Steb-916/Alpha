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
