/**
 * Deribit exchange connector (public REST only).
 *
 * All endpoints are public. Base URL: https://www.deribit.com/api/v2/public/
 * Deribit returns `{ result, usIn, usOut, usDiff, testnet }` envelopes — we
 * extract `result`.
 *
 * Rate limit for public endpoints: 20 req/s. With 2 book-summary calls per
 * cron cycle (BTC + ETH) we're trivially within limits.
 */

import type {
  DeribitBookSummary,
  DeribitCurrency,
  DeribitInstrument,
  DeribitOrderBook,
  DeribitVolHistoryPoint,
} from './deribit-types';

const REST_BASE =
  process.env.DERIBIT_REST_URL || 'https://www.deribit.com/api/v2/public';

async function fetchJSON<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(
          ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
        )
        .join('&')
    : '';
  const url = REST_BASE + path + query;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Deribit REST error ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: unknown };
  if (json.error) {
    throw new Error(`Deribit API error: ${JSON.stringify(json.error)}`);
  }
  if (json.result === undefined) {
    throw new Error('Deribit response missing result');
  }
  return json.result;
}

export class DeribitConnector {
  readonly name = 'deribit';

  /**
   * All active option instruments for a currency. Returns static metadata
   * (strike, expiration, option_type) — no pricing.
   */
  async getInstruments(
    currency: DeribitCurrency,
  ): Promise<DeribitInstrument[]> {
    return fetchJSON<DeribitInstrument[]>('/get_instruments', {
      currency,
      kind: 'option',
      expired: 'false',
    });
  }

  /**
   * Book summary for every active option in one call. Includes mark_iv,
   * bid_iv, ask_iv, OI, volume, and underlying_price.
   */
  async getBookSummary(
    currency: DeribitCurrency,
  ): Promise<DeribitBookSummary[]> {
    return fetchJSON<DeribitBookSummary[]>(
      '/get_book_summary_by_currency',
      {
        currency,
        kind: 'option',
      },
    );
  }

  /**
   * Detailed order book for a single instrument. Includes Greeks (delta,
   * gamma, vega, theta, rho) that the book summary does not expose.
   * Not called in bulk — too slow — only used opportunistically for
   * individual instrument detail views.
   */
  async getOrderBook(instrumentName: string): Promise<DeribitOrderBook> {
    return fetchJSON<DeribitOrderBook>('/get_order_book', {
      instrument_name: instrumentName,
    });
  }

  /**
   * Historical realized volatility. Returns array of [timestamp, value]
   * pairs. We normalize to {timestamp, value}.
   */
  async getHistoricalVolatility(
    currency: DeribitCurrency,
  ): Promise<DeribitVolHistoryPoint[]> {
    const raw = await fetchJSON<Array<[number, number]>>(
      '/get_historical_volatility',
      { currency },
    );
    return raw.map(([timestamp, value]) => ({ timestamp, value }));
  }

  /**
   * Index (spot) price for BTC or ETH. Uses the `ticker` endpoint on the
   * perpetual instrument since Deribit doesn't expose a raw index endpoint
   * on the public API we need.
   */
  async getIndexPrice(currency: DeribitCurrency): Promise<number> {
    const ticker = await fetchJSON<{
      index_price: number;
      mark_price: number;
    }>('/ticker', { instrument_name: `${currency}-PERPETUAL` });
    return ticker.index_price ?? ticker.mark_price ?? 0;
  }
}
