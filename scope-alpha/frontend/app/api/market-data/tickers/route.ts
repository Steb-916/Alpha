/**
 * GET /api/market-data/tickers
 *
 * Returns current 24hr ticker stats for all tracked symbols (screener)
 * or a single symbol if ?symbol= is provided.
 *
 * Query params:
 *   symbol - (optional) e.g. "BTCUSDT"
 */

import { NextRequest, NextResponse } from 'next/server';
import { tryExchanges } from '@/lib/exchanges';
import { toBinanceSymbol } from '@/lib/exchanges/utils';
import { getMarketDataCache } from '@/lib/market-data/cache';
import { ALL_TRACKED_SYMBOLS } from '@/lib/exchanges/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawSymbol = searchParams.get('symbol');

    const cache = getMarketDataCache();

    // Single symbol request
    if (rawSymbol) {
      const symbol = toBinanceSymbol(rawSymbol);
      let ticker = cache.getLatestTicker(symbol);
      if (ticker) {
        return NextResponse.json({ data: [ticker] });
      }

      // Fetch from first reachable exchange (handles Binance geo-blocks).
      const tickers = await tryExchanges(
        (ex) => ex.get24hrTicker(symbol),
        `ticker ${symbol}`
      );
      tickers.forEach((t) => cache.setLatestTicker(t.symbol, t));
      return NextResponse.json({ data: tickers });
    }

    // All tickers — check cache first
    const cached = cache.getAllTickers();
    if (cached.size >= ALL_TRACKED_SYMBOLS.length * 0.5) {
      const data = ALL_TRACKED_SYMBOLS
        .map((s) => cached.get(s))
        .filter(Boolean);
      if (data.length > 0) {
        return NextResponse.json({ data });
      }
    }

    // Fetch all tickers from first reachable exchange.
    const allTickers = await tryExchanges(
      (ex) => ex.get24hrTicker(),
      'all tickers'
    );

    // Cache and filter to tracked symbols
    const tracked = new Set(ALL_TRACKED_SYMBOLS);
    const result = allTickers.filter((t) => tracked.has(t.symbol));
    result.forEach((t) => cache.setLatestTicker(t.symbol, t));

    // Also cache the rest for screener use
    allTickers.forEach((t) => cache.setLatestTicker(t.symbol, t));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[API /market-data/tickers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticker data', message: String(error) },
      { status: 500 }
    );
  }
}
