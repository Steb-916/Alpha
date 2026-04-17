/**
 * GET /api/cron/persist-candles
 *
 * Daily cron (scheduled 1am UTC via vercel.json) that snapshots 4h and 1d
 * candles for every enabled asset across Binance and Bybit into the
 * `CandleHistory` table. Used by the Quant Engine for backtesting and regime
 * classification work.
 *
 * Idempotent: the unique constraint (asset, exchange, timeframe, timestamp)
 * means re-running the cron for the same day overwrites the existing row
 * with the latest close but never duplicates it.
 */

import { NextResponse } from 'next/server';
import { ENABLED_ASSETS } from '@/config/assets';
import { BinanceConnector } from '@/lib/exchanges/binance';
import { BybitConnector } from '@/lib/exchanges/bybit';
import { persistCandleHistory } from '@/lib/market/persistence';
import type { ExchangeConnector } from '@/lib/exchanges/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const binance = new BinanceConnector();
const bybit = new BybitConnector();

const TIMEFRAMES: Array<{ app: string; limit: number }> = [
  { app: '4h', limit: 7 }, // Last ~1 day of 4h candles (with buffer)
  { app: '1d', limit: 3 }, // Last few daily candles
];

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function persistForExchange(
  exchange: 'binance' | 'bybit',
  connector: ExchangeConnector,
  assetSymbol: string,
  pairSymbol: string,
): Promise<{ written: number; error?: string }> {
  let written = 0;
  for (const tf of TIMEFRAMES) {
    try {
      const candles = await connector.getKlines(pairSymbol, tf.app, tf.limit);
      const rows = candles.map((c) => ({
        asset: assetSymbol,
        exchange,
        timeframe: tf.app,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        // Exchange connectors expose `time` in seconds
        timestamp: new Date(c.time * 1000),
      }));
      written += await persistCandleHistory(rows);
    } catch (err) {
      return {
        written,
        error: `${exchange}:${assetSymbol}:${tf.app} → ${(err as Error).message}`,
      };
    }
  }
  return { written };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const errors: string[] = [];
  let totalWritten = 0;

  // Process assets in small parallel batches to control rate-limit pressure.
  const BATCH_SIZE = 3;
  for (let i = 0; i < ENABLED_ASSETS.length; i += BATCH_SIZE) {
    const batch = ENABLED_ASSETS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.flatMap((asset) => [
        persistForExchange('binance', binance, asset.symbol, asset.binance),
        persistForExchange('bybit', bybit, asset.symbol, asset.bybit),
      ]),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalWritten += r.value.written;
        if (r.value.error) errors.push(r.value.error);
      } else {
        errors.push(String(r.reason));
      }
    }
  }

  const elapsedMs = Date.now() - startTs;
  console.log(
    `[persist-candles] wrote ${totalWritten} rows across ${ENABLED_ASSETS.length} assets in ${elapsedMs}ms (${errors.length} errors)`,
  );

  return NextResponse.json({
    ok: true,
    rowsWritten: totalWritten,
    assets: ENABLED_ASSETS.length,
    errors: errors.slice(0, 10), // Trim noisy error list
    elapsedMs,
  });
}
