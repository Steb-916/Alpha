/**
 * Server-side WebSocket Manager.
 *
 * Manages exchange WebSocket connections with:
 * - Singleton per stream (connection reuse)
 * - Automatic reconnection with exponential backoff
 * - Subscription reference counting
 * - 30-second grace period before unsubscribe
 * - Heartbeat/ping-pong monitoring
 */

import type { OHLCV, Ticker, FundingRate, Liquidation, MarkPrice } from '../exchanges/types';
import { getMarketDataCache } from './cache';
import { toBinanceSymbol, toBinanceInterval } from '../exchanges/utils';

const WS_BASE = process.env.BINANCE_FUTURES_WS_URL || 'wss://fstream.binance.com';

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageHandler = (data: any) => void;

interface StreamSubscription {
  stream: string;
  handlers: Set<MessageHandler>;
  unsubscribeTimer: ReturnType<typeof setTimeout> | null;
}

interface ConnectionState {
  ws: any; // WebSocket instance (ws package)
  connected: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastPing: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

// ─── Callback Registry ──────────────────────────────────────────────────────

export type SSEClient = {
  id: string;
  send: (event: string, data: any) => void;
  symbols: string[];
  intervals: string[];
  channels: string[];
};

// ─── WebSocket Manager ──────────────────────────────────────────────────────

class WebSocketManager {
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private connection: ConnectionState | null = null;
  private sseClients: Map<string, SSEClient> = new Map();
  private combinedStreams: Set<string> = new Set();
  private _initialized = false;

  private readonly GRACE_PERIOD_MS = 30_000;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly HEARTBEAT_TIMEOUT_MS = 300_000; // 5 minutes
  private readonly HEARTBEAT_CHECK_MS = 60_000;    // Check every minute

  // ── Public API ──

  /**
   * Subscribe to a Binance stream. Returns an unsubscribe function.
   */
  subscribe(stream: string, handler: MessageHandler): () => void {
    let sub = this.subscriptions.get(stream);

    if (sub) {
      // Cancel any pending unsubscribe
      if (sub.unsubscribeTimer) {
        clearTimeout(sub.unsubscribeTimer);
        sub.unsubscribeTimer = null;
      }
      sub.handlers.add(handler);
    } else {
      sub = { stream, handlers: new Set([handler]), unsubscribeTimer: null };
      this.subscriptions.set(stream, sub);
      this.combinedStreams.add(stream);
      this._reconnectWithNewStreams();
    }

    return () => {
      const s = this.subscriptions.get(stream);
      if (!s) return;
      s.handlers.delete(handler);

      if (s.handlers.size === 0) {
        // Grace period before actual unsubscribe
        s.unsubscribeTimer = setTimeout(() => {
          if (s.handlers.size === 0) {
            this.subscriptions.delete(stream);
            this.combinedStreams.delete(stream);
            this._reconnectWithNewStreams();
          }
        }, this.GRACE_PERIOD_MS);
      }
    };
  }

  /**
   * Subscribe to kline stream for a symbol/interval.
   * Updates cache and notifies SSE clients.
   */
  subscribeKline(symbol: string, interval: string): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const intv = toBinanceInterval(interval);
    const stream = `${sym}@kline_${intv}`;
    const cache = getMarketDataCache();

    return this.subscribe(stream, (msg: any) => {
      const k = msg.k;
      if (!k) return;

      const candle: OHLCV = {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        exchange: 'binance',
        symbol: toBinanceSymbol(symbol),
        interval: intv,
        isClosed: k.x,
      };

      cache.appendKline(candle.symbol, intv, candle);
      this._notifySSEClients('kline', candle);
    });
  }

  /**
   * Subscribe to mark price + funding rate for a symbol.
   */
  subscribeMarkPrice(symbol: string): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${sym}@markPrice@1s`;
    const cache = getMarketDataCache();

    return this.subscribe(stream, (msg: any) => {
      const markPrice: MarkPrice = {
        symbol: toBinanceSymbol(symbol),
        exchange: 'binance',
        markPrice: parseFloat(msg.p),
        indexPrice: parseFloat(msg.i),
        fundingRate: parseFloat(msg.r),
        nextFundingTime: msg.T,
        timestamp: msg.E,
      };

      // Update funding rate in cache
      cache.setFundingRate(markPrice.symbol, {
        symbol: markPrice.symbol,
        exchange: 'binance',
        fundingRate: markPrice.fundingRate,
        fundingTime: markPrice.timestamp,
        markPrice: markPrice.markPrice,
        nextFundingTime: markPrice.nextFundingTime,
      });

      this._notifySSEClients('funding', {
        symbol: markPrice.symbol,
        exchange: 'binance',
        fundingRate: markPrice.fundingRate,
        markPrice: markPrice.markPrice,
        indexPrice: markPrice.indexPrice,
        nextFundingTime: markPrice.nextFundingTime,
        timestamp: markPrice.timestamp,
      });
    });
  }

  /**
   * Subscribe to liquidation stream for a symbol.
   */
  subscribeLiquidation(symbol: string): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${sym}@forceOrder`;
    const cache = getMarketDataCache();

    return this.subscribe(stream, (msg: any) => {
      const o = msg.o;
      if (!o) return;

      const liq: Liquidation = {
        symbol: toBinanceSymbol(symbol),
        exchange: 'binance',
        side: o.S === 'BUY' ? 'short' : 'long',
        price: parseFloat(o.p),
        quantity: parseFloat(o.q),
        timestamp: o.T,
      };

      cache.addLiquidation(liq);
      this._notifySSEClients('liquidation', liq);
    });
  }

  /**
   * Subscribe to all tickers (for screener).
   */
  subscribeAllTickers(): () => void {
    const stream = '!ticker@arr';
    const cache = getMarketDataCache();

    return this.subscribe(stream, (msg: any) => {
      if (!Array.isArray(msg)) return;

      const tickers: Ticker[] = msg
        .filter((t: any) => t.s?.endsWith('USDT'))
        .map((t: any) => ({
          symbol: t.s,
          exchange: 'binance',
          lastPrice: parseFloat(t.c),
          priceChange24h: parseFloat(t.p),
          priceChangePercent24h: parseFloat(t.P),
          volume24h: parseFloat(t.q),
          high24h: parseFloat(t.h),
          low24h: parseFloat(t.l),
          timestamp: t.E,
        }));

      tickers.forEach((t) => cache.setLatestTicker(t.symbol, t));
      this._notifySSEClients('ticker', tickers);
    });
  }

  // ── SSE Client Management ──

  registerSSEClient(client: SSEClient): void {
    this.sseClients.set(client.id, client);
  }

  unregisterSSEClient(clientId: string): void {
    this.sseClients.delete(clientId);
  }

  getSSEClientCount(): number {
    return this.sseClients.size;
  }

  getSSEClients(): IterableIterator<SSEClient> {
    return this.sseClients.values();
  }

  // ── Connection Management ──

  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    console.log('[WSManager] Initializing...');
  }

  shutdown(): void {
    if (this.connection) {
      if (this.connection.heartbeatTimer) {
        clearInterval(this.connection.heartbeatTimer);
      }
      if (this.connection.reconnectTimer) {
        clearTimeout(this.connection.reconnectTimer);
      }
      try { this.connection.ws?.close(); } catch { /* ignore */ }
      this.connection = null;
    }
    this.subscriptions.clear();
    this.combinedStreams.clear();
    this.sseClients.clear();
    this._initialized = false;
  }

  // ── Private Methods ──

  private _reconnectWithNewStreams(): void {
    // Close existing connection and open new one with all streams
    if (this.connection) {
      if (this.connection.heartbeatTimer) {
        clearInterval(this.connection.heartbeatTimer);
      }
      try { this.connection.ws?.close(); } catch { /* ignore */ }
      this.connection = null;
    }

    if (this.combinedStreams.size === 0) return;

    this._connect();
  }

  private _connect(): void {
    if (this.combinedStreams.size === 0) return;

    const streams = Array.from(this.combinedStreams).join('/');
    const wsUrl = `${WS_BASE}/stream?streams=${streams}`;

    try {
      // Dynamic import for server-side ws package
      const WS = require('ws');
      const ws = new WS(wsUrl);

      const state: ConnectionState = {
        ws,
        connected: false,
        reconnectAttempts: 0,
        reconnectTimer: null,
        lastPing: Date.now(),
        heartbeatTimer: null,
      };

      ws.on('open', () => {
        state.connected = true;
        state.reconnectAttempts = 0;
        state.lastPing = Date.now();
        console.log(`[WSManager] Connected with ${this.combinedStreams.size} streams`);

        // Start heartbeat checker
        state.heartbeatTimer = setInterval(() => {
          if (Date.now() - state.lastPing > this.HEARTBEAT_TIMEOUT_MS) {
            console.warn('[WSManager] Heartbeat timeout, reconnecting...');
            try { ws.close(); } catch { /* ignore */ }
          }
        }, this.HEARTBEAT_CHECK_MS);
      });

      ws.on('message', (raw: any) => {
        state.lastPing = Date.now();
        try {
          const msg = JSON.parse(raw.toString());
          // Combined stream format: { stream: "...", data: {...} }
          if (msg.stream && msg.data) {
            const sub = this.subscriptions.get(msg.stream);
            if (sub) {
              for (const handler of sub.handlers) {
                try { handler(msg.data); } catch (err) {
                  console.error('[WSManager] Handler error:', err);
                }
              }
            }
          }
        } catch { /* skip malformed */ }
      });

      ws.on('ping', () => {
        state.lastPing = Date.now();
        try { ws.pong(); } catch { /* ignore */ }
      });

      ws.on('close', () => {
        state.connected = false;
        if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
        console.log('[WSManager] Connection closed');
        this._scheduleReconnect(state);
      });

      ws.on('error', (err: any) => {
        console.error('[WSManager] WebSocket error:', err.message);
        try { ws.close(); } catch { /* ignore */ }
      });

      this.connection = state;
    } catch (err) {
      console.error('[WSManager] Failed to create WebSocket:', err);
      this._scheduleReconnect(this.connection || {
        ws: null, connected: false, reconnectAttempts: 0,
        reconnectTimer: null, lastPing: 0, heartbeatTimer: null,
      });
    }
  }

  private _scheduleReconnect(state: ConnectionState): void {
    if (state.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[WSManager] Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. ` +
        'Pausing for 60s before retrying.'
      );
      state.reconnectTimer = setTimeout(() => {
        state.reconnectAttempts = 0;
        this._connect();
      }, 60_000);
      return;
    }

    const delay = Math.min(
      1000 * Math.pow(2, state.reconnectAttempts),
      30_000
    );
    state.reconnectAttempts++;
    console.log(
      `[WSManager] Reconnecting in ${delay}ms ` +
      `(attempt ${state.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`
    );

    state.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay);
  }

  private _notifySSEClients(event: string, data: any): void {
    for (const client of this.sseClients.values()) {
      try {
        // Filter: only send if client is subscribed to this channel
        if (!client.channels.includes(event) && event !== 'heartbeat') continue;

        // For per-symbol events, check if client is subscribed to this symbol
        if (data?.symbol && client.symbols.length > 0) {
          if (!client.symbols.includes(data.symbol)) continue;
        }

        client.send(event, data);
      } catch {
        // Client likely disconnected, will be cleaned up
      }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _manager: WebSocketManager | null = null;

export function getWSManager(): WebSocketManager {
  if (!_manager) {
    _manager = new WebSocketManager();
  }
  return _manager;
}
