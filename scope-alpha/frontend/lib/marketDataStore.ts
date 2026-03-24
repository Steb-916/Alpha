'use client';

/**
 * Client-side Zustand store for live market data.
 *
 * Manages SSE connection and exposes real-time data to all UI components.
 * Does NOT persist to localStorage (data changes every second).
 */

import { create } from 'zustand';
import type { OHLCV, Ticker, FundingRate, OpenInterest, Liquidation } from './exchanges/types';
import { toBinanceSymbol, toBinanceInterval } from './exchanges/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface MarketDataState {
  // Connection state
  connectionStatus: ConnectionStatus;
  lastHeartbeat: number | null;

  // Per-symbol live data
  klines: Record<string, Record<string, OHLCV[]>>; // [symbol][interval] → candles
  tickers: Record<string, Ticker>;                   // [symbol] → latest ticker
  fundingRates: Record<string, FundingRate>;          // [symbol] → latest funding
  openInterest: Record<string, OpenInterest>;         // [symbol] → latest OI
  liquidations: Liquidation[];                        // Rolling buffer, last 100

  // Loading state for initial fetches
  isLoadingKlines: boolean;

  // SSE connection
  _eventSource: EventSource | null;
  _heartbeatTimer: ReturnType<typeof setInterval> | null;

  // Actions
  connect: (symbols: string[], intervals: string[], channels: string[]) => void;
  disconnect: () => void;
  updateSubscriptions: (symbols: string[], intervals: string[], channels: string[]) => void;
  fetchKlines: (symbol: string, interval: string, limit?: number) => Promise<OHLCV[]>;
  fetchTickers: () => Promise<Ticker[]>;
  fetchFundingRates: (symbol: string) => Promise<{ current: FundingRate; history: FundingRate[] }>;
  fetchOpenInterest: (symbol: string) => Promise<{ current: OpenInterest; history: OpenInterest[] }>;

  // Selectors
  getKlines: (symbol: string, interval: string) => OHLCV[];
  getTicker: (symbol: string) => Ticker | null;
  getFundingRate: (symbol: string) => FundingRate | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LIQUIDATIONS = 100;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const API_BASE = '/api/market-data';

// ─── Store ──────────────────────────────────────────────────────────────────

export const useMarketDataStore = create<MarketDataState>()((set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  lastHeartbeat: null,
  klines: {},
  tickers: {},
  fundingRates: {},
  openInterest: {},
  liquidations: [],
  isLoadingKlines: false,
  _eventSource: null,
  _heartbeatTimer: null,

  // ── Actions ──

  connect: (symbols, intervals, channels) => {
    const state = get();

    // Clean up existing connection
    if (state._eventSource) {
      state._eventSource.close();
    }
    if (state._heartbeatTimer) {
      clearInterval(state._heartbeatTimer);
    }

    set({ connectionStatus: 'connecting' });

    const params = new URLSearchParams({
      symbols: symbols.map((s) => toBinanceSymbol(s)).join(','),
      intervals: intervals.map((i) => toBinanceInterval(i)).join(','),
      channels: channels.join(','),
    });

    const es = new EventSource(`${API_BASE}/stream?${params}`);

    // Handle SSE events
    es.addEventListener('kline', (e) => {
      try {
        const candle: OHLCV = JSON.parse(e.data);
        set((state) => {
          const symbol = candle.symbol;
          const interval = candle.interval;
          const current = state.klines[symbol]?.[interval] || [];

          let updated: OHLCV[];
          if (current.length > 0 && current[current.length - 1].time === candle.time) {
            // Update current candle in-place
            updated = [...current.slice(0, -1), candle];
          } else if (candle.isClosed || current.length === 0) {
            // Append new candle
            updated = [...current, candle];
            if (updated.length > 1000) updated = updated.slice(-1000);
          } else {
            updated = [...current, candle];
          }

          return {
            klines: {
              ...state.klines,
              [symbol]: {
                ...state.klines[symbol],
                [interval]: updated,
              },
            },
          };
        });
      } catch { /* skip malformed */ }
    });

    es.addEventListener('ticker', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Can be a single ticker or array
        const tickers: Ticker[] = Array.isArray(data) ? data : [data];
        set((state) => {
          const updated = { ...state.tickers };
          tickers.forEach((t) => { updated[t.symbol] = t; });
          return { tickers: updated };
        });
      } catch { /* skip */ }
    });

    es.addEventListener('funding', (e) => {
      try {
        const data: FundingRate = JSON.parse(e.data);
        set((state) => ({
          fundingRates: { ...state.fundingRates, [data.symbol]: data },
        }));
      } catch { /* skip */ }
    });

    es.addEventListener('liquidation', (e) => {
      try {
        const liq: Liquidation = JSON.parse(e.data);
        set((state) => {
          const updated = [...state.liquidations, liq];
          return {
            liquidations: updated.length > MAX_LIQUIDATIONS
              ? updated.slice(-MAX_LIQUIDATIONS)
              : updated,
          };
        });
      } catch { /* skip */ }
    });

    es.addEventListener('openInterest', (e) => {
      try {
        const oi: OpenInterest = JSON.parse(e.data);
        set((state) => ({
          openInterest: { ...state.openInterest, [oi.symbol]: oi },
        }));
      } catch { /* skip */ }
    });

    es.addEventListener('heartbeat', (e) => {
      try {
        const hb = JSON.parse(e.data);
        set({ lastHeartbeat: hb.timestamp, connectionStatus: 'connected' });
      } catch { /* skip */ }
    });

    es.onopen = () => {
      set({ connectionStatus: 'connected' });
    };

    es.onerror = () => {
      set({ connectionStatus: 'error' });
      // EventSource auto-reconnects; we just update status
    };

    // Heartbeat timeout checker
    const heartbeatTimer = setInterval(() => {
      const { lastHeartbeat } = get();
      if (lastHeartbeat && Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
        set({ connectionStatus: 'error' });
      }
    }, 10_000);

    set({ _eventSource: es, _heartbeatTimer: heartbeatTimer });
  },

  disconnect: () => {
    const { _eventSource, _heartbeatTimer } = get();
    if (_eventSource) _eventSource.close();
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    set({
      connectionStatus: 'disconnected',
      _eventSource: null,
      _heartbeatTimer: null,
    });
  },

  updateSubscriptions: (symbols, intervals, channels) => {
    const state = get();
    state.disconnect();
    state.connect(symbols, intervals, channels);
  },

  fetchKlines: async (symbol, interval, limit = 500) => {
    set({ isLoadingKlines: true });
    try {
      const sym = toBinanceSymbol(symbol);
      const intv = toBinanceInterval(interval);
      const res = await fetch(
        `${API_BASE}/klines?symbol=${sym}&interval=${intv}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const klines: OHLCV[] = json.data || [];

      set((state) => ({
        klines: {
          ...state.klines,
          [sym]: {
            ...state.klines[sym],
            [intv]: klines,
          },
        },
        isLoadingKlines: false,
      }));

      return klines;
    } catch (err) {
      console.error('[MarketDataStore] fetchKlines error:', err);
      set({ isLoadingKlines: false });
      return [];
    }
  },

  fetchTickers: async () => {
    try {
      const res = await fetch(`${API_BASE}/tickers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const tickers: Ticker[] = json.data || [];

      set((state) => {
        const updated = { ...state.tickers };
        tickers.forEach((t) => { updated[t.symbol] = t; });
        return { tickers: updated };
      });

      return tickers;
    } catch (err) {
      console.error('[MarketDataStore] fetchTickers error:', err);
      return [];
    }
  },

  fetchFundingRates: async (symbol) => {
    try {
      const sym = toBinanceSymbol(symbol);
      const res = await fetch(`${API_BASE}/funding-rates?symbol=${sym}&limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.current) {
        set((state) => ({
          fundingRates: { ...state.fundingRates, [sym]: json.current },
        }));
      }

      return { current: json.current, history: json.history || [] };
    } catch (err) {
      console.error('[MarketDataStore] fetchFundingRates error:', err);
      return { current: null as any, history: [] };
    }
  },

  fetchOpenInterest: async (symbol) => {
    try {
      const sym = toBinanceSymbol(symbol);
      const res = await fetch(`${API_BASE}/open-interest?symbol=${sym}&limit=30`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.current) {
        set((state) => ({
          openInterest: { ...state.openInterest, [sym]: json.current },
        }));
      }

      return { current: json.current, history: json.history || [] };
    } catch (err) {
      console.error('[MarketDataStore] fetchOpenInterest error:', err);
      return { current: null as any, history: [] };
    }
  },

  // ── Selectors ──

  getKlines: (symbol, interval) => {
    const sym = toBinanceSymbol(symbol);
    const intv = toBinanceInterval(interval);
    return get().klines[sym]?.[intv] || [];
  },

  getTicker: (symbol) => {
    return get().tickers[toBinanceSymbol(symbol)] || null;
  },

  getFundingRate: (symbol) => {
    return get().fundingRates[toBinanceSymbol(symbol)] || null;
  },
}));
