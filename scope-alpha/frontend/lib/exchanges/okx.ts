/**
 * OKX exchange connector — STUB for Phase 1.
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

const REST_BASE = process.env.OKX_REST_URL || 'https://www.okx.com/api/v5';

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, REST_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OKX REST error ${res.status}`);
  const json = await res.json();
  if (json.code !== '0') throw new Error(`OKX API error: ${json.msg}`);
  return json.data as T;
}

function toOKXInstId(symbol: string): string {
  // BTCUSDT → BTC-USDT-SWAP
  const base = symbol.toUpperCase().replace('USDT', '');
  return `${base}-USDT-SWAP`;
}

export class OKXConnector implements ExchangeConnector {
  name = 'okx';
  private _connected = false;

  async getKlines(symbol: string, interval: string, limit = 100): Promise<OHLCV[]> {
    const barMap: Record<string, string> = {
      '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
      '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6H', '12h': '12H',
      '1d': '1D', '1w': '1W', '1M': '1M',
    };
    const raw = await fetchJSON<string[][]>('/market/candles', {
      instId: toOKXInstId(symbol),
      bar: barMap[interval] || '1H',
      limit: String(limit),
    });
    return (raw || []).reverse().map((k) => ({
      time: Math.floor(parseInt(k[0]) / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      exchange: 'okx',
      symbol: symbol.toUpperCase(),
      interval,
      isClosed: true,
    }));
  }

  async getFundingRate(symbol: string): Promise<FundingRate> {
    const raw = await fetchJSON<any[]>('/public/funding-rate', {
      instId: toOKXInstId(symbol),
    });
    const d = raw?.[0] || {};
    return {
      symbol: symbol.toUpperCase(),
      exchange: 'okx',
      fundingRate: parseFloat(d.fundingRate || '0'),
      fundingTime: parseInt(d.fundingTime || String(Date.now())),
      markPrice: 0,
      nextFundingTime: parseInt(d.nextFundingTime || '0'),
    };
  }

  async getFundingRateHistory(symbol: string, limit = 100): Promise<FundingRate[]> {
    const raw = await fetchJSON<any[]>('/public/funding-rate-history', {
      instId: toOKXInstId(symbol),
      limit: String(limit),
    });
    return (raw || []).map((r: any) => ({
      symbol: symbol.toUpperCase(),
      exchange: 'okx',
      fundingRate: parseFloat(r.fundingRate || '0'),
      fundingTime: parseInt(r.fundingTime || '0'),
      markPrice: parseFloat(r.realizedRate || '0'),
      nextFundingTime: 0,
    }));
  }

  async getOpenInterest(symbol: string): Promise<OpenInterest> {
    const raw = await fetchJSON<any[]>('/public/open-interest', {
      instType: 'SWAP',
      instId: toOKXInstId(symbol),
    });
    const d = raw?.[0] || {};
    return {
      symbol: symbol.toUpperCase(),
      exchange: 'okx',
      openInterest: parseFloat(d.oi || '0'),
      openInterestValue: parseFloat(d.oiCcy || '0'),
      timestamp: parseInt(d.ts || String(Date.now())),
    };
  }

  async getOpenInterestHistory(_symbol: string, _period = '1h', _limit = 30): Promise<OpenInterest[]> {
    // OKX doesn't have a direct OI history endpoint in the same format
    return [];
  }

  async get24hrTicker(symbol?: string): Promise<Ticker[]> {
    const params: Record<string, string> = { instType: 'SWAP' };
    if (symbol) params.instId = toOKXInstId(symbol);
    const raw = await fetchJSON<any[]>('/market/tickers', params);
    return (raw || [])
      .filter((t: any) => t.instId?.includes('-USDT-'))
      .map((t: any) => {
        const last = parseFloat(t.last || '0');
        const open = parseFloat(t.open24h || '0');
        return {
          symbol: t.instId.replace('-USDT-SWAP', 'USDT').replace('-', ''),
          exchange: 'okx',
          lastPrice: last,
          priceChange24h: last - open,
          priceChangePercent24h: open > 0 ? ((last - open) / open) * 100 : 0,
          volume24h: parseFloat(t.volCcy24h || '0'),
          high24h: parseFloat(t.high24h || '0'),
          low24h: parseFloat(t.low24h || '0'),
          timestamp: parseInt(t.ts || String(Date.now())),
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
