/**
 * Bybit exchange connector — STUB for Phase 1.
 * Only REST methods are implemented; WebSocket stubs return no-ops.
 */

import type {
  ExchangeConnector,
  OHLCV,
  FundingRate,
  OpenInterest,
  Liquidation,
  Ticker,
  MarkPrice,
} from './types';

const REST_BASE = process.env.BYBIT_REST_URL || 'https://api.bybit.com/v5';

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  // Direct concat — `new URL(path, base)` drops the /v5 prefix when path
  // starts with "/", which turned every call into a 404/403.
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const url = REST_BASE + path + query;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Bybit REST error ${res.status}`);
  const json = await res.json();
  if (json.retCode !== 0) throw new Error(`Bybit API error: ${json.retMsg}`);
  return json.result as T;
}

export class BybitConnector implements ExchangeConnector {
  name = 'bybit';
  private _connected = false;

  async getKlines(symbol: string, interval: string, limit = 200): Promise<OHLCV[]> {
    const intervalMap: Record<string, string> = {
      '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
      '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
      '1d': 'D', '1w': 'W', '1M': 'M',
    };
    const result = await fetchJSON<{ list: string[][] }>('/market/kline', {
      category: 'linear',
      symbol: symbol.toUpperCase(),
      interval: intervalMap[interval] || '60',
      limit: String(limit),
    });
    return (result.list || []).reverse().map((k) => ({
      time: Math.floor(parseInt(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      exchange: 'bybit',
      symbol: symbol.toUpperCase(),
      interval,
      isClosed: true,
    }));
  }

  async getFundingRate(symbol: string): Promise<FundingRate> {
    const result = await fetchJSON<{ list: any[] }>('/market/tickers', {
      category: 'linear',
      symbol: symbol.toUpperCase(),
    });
    const t = result.list?.[0] || {};
    return {
      symbol: symbol.toUpperCase(),
      exchange: 'bybit',
      fundingRate: parseFloat(t.fundingRate || '0'),
      fundingTime: Date.now(),
      markPrice: parseFloat(t.markPrice || '0'),
      nextFundingTime: parseInt(t.nextFundingTime || '0'),
    };
  }

  async getFundingRateHistory(symbol: string, limit = 100): Promise<FundingRate[]> {
    const result = await fetchJSON<{ list: any[] }>('/market/funding/history', {
      category: 'linear',
      symbol: symbol.toUpperCase(),
      limit: String(limit),
    });
    return (result.list || []).map((r: any) => ({
      symbol: symbol.toUpperCase(),
      exchange: 'bybit',
      fundingRate: parseFloat(r.fundingRate),
      fundingTime: parseInt(r.fundingRateTimestamp),
      markPrice: 0,
      nextFundingTime: 0,
    }));
  }

  async getOpenInterest(symbol: string): Promise<OpenInterest> {
    // Bybit's dedicated OI endpoint returns contracts only. To compute the USD
    // value we fetch the ticker in parallel and multiply by last price. Falls
    // back to 0 if the ticker fetch fails — the aggregator tolerates nulls.
    const [oiRes, tickerRes] = await Promise.allSettled([
      fetchJSON<{ list: any[] }>('/market/open-interest', {
        category: 'linear',
        symbol: symbol.toUpperCase(),
        intervalTime: '1h',
        limit: '1',
      }),
      fetchJSON<{ list: any[] }>('/market/tickers', {
        category: 'linear',
        symbol: symbol.toUpperCase(),
      }),
    ]);

    const oiItem =
      oiRes.status === 'fulfilled' ? oiRes.value.list?.[0] || {} : {};
    const tickerItem =
      tickerRes.status === 'fulfilled' ? tickerRes.value.list?.[0] || {} : {};

    const oi = parseFloat(oiItem.openInterest || '0');
    const lastPrice = parseFloat(tickerItem.lastPrice || '0');
    const oiValue = oi > 0 && lastPrice > 0 ? oi * lastPrice : 0;

    return {
      symbol: symbol.toUpperCase(),
      exchange: 'bybit',
      openInterest: oi,
      openInterestValue: oiValue,
      timestamp: parseInt(oiItem.timestamp || String(Date.now())),
    };
  }

  async getOpenInterestHistory(symbol: string, period = '1h', limit = 30): Promise<OpenInterest[]> {
    const result = await fetchJSON<{ list: any[] }>('/market/open-interest', {
      category: 'linear',
      symbol: symbol.toUpperCase(),
      intervalTime: period === '5m' ? '5min' : period === '15m' ? '15min' : period === '30m' ? '30min' : '1h',
      limit: String(limit),
    });
    return (result.list || []).reverse().map((r: any) => ({
      symbol: symbol.toUpperCase(),
      exchange: 'bybit',
      openInterest: parseFloat(r.openInterest || '0'),
      openInterestValue: 0,
      timestamp: parseInt(r.timestamp || String(Date.now())),
    }));
  }

  async get24hrTicker(symbol?: string): Promise<Ticker[]> {
    const params: Record<string, string> = { category: 'linear' };
    if (symbol) params.symbol = symbol.toUpperCase();
    const result = await fetchJSON<{ list: any[] }>('/market/tickers', params);
    return (result.list || [])
      .filter((t: any) => t.symbol?.endsWith('USDT'))
      .map((t: any) => {
        const lastPrice = parseFloat(t.lastPrice || '0');
        const prev = parseFloat(t.prevPrice24h || '0');
        return {
          symbol: t.symbol,
          exchange: 'bybit',
          lastPrice,
          // Bybit gives `price24hPcnt` as a fractional change (e.g. 0.024 = +2.4%).
          // The previous code multiplied two unrelated quantities — fixed below.
          priceChange24h: lastPrice - prev,
          priceChangePercent24h: parseFloat(t.price24hPcnt || '0') * 100,
          volume24h: parseFloat(t.turnover24h || '0'),
          high24h: parseFloat(t.highPrice24h || '0'),
          low24h: parseFloat(t.lowPrice24h || '0'),
          timestamp: Date.now(),
        };
      });
  }

  // WebSocket stubs — Phase 1 stretch
  subscribeKline(_s?: string, _i?: string, _cb?: (d: OHLCV) => void): () => void { return () => {}; }
  subscribeMarkPrice(_s?: string, _cb?: (d: MarkPrice) => void): () => void { return () => {}; }
  subscribeLiquidation(_s?: string, _cb?: (d: Liquidation) => void): () => void { return () => {}; }
  subscribeAllTickers(_cb?: (d: Ticker[]) => void): () => void { return () => {}; }

  async connect(): Promise<void> { this._connected = true; }
  disconnect(): void { this._connected = false; }
  isConnected(): boolean { return this._connected; }
}
