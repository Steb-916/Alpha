/**
 * Stream Coordinator.
 *
 * Coordinates the WebSocket Manager, Cache, and SSE fanout.
 * Manages which symbols/streams are active based on connected SSE clients.
 */

import { getWSManager } from './ws-manager';
import { getMarketDataCache } from './cache';
import { tryExchanges } from '../exchanges';
import { TIER1_SYMBOLS, ALL_TRACKED_SYMBOLS } from '../exchanges/types';
import type { SSEClient } from './ws-manager';

class StreamCoordinator {
  private activeUnsubscribers: Map<string, () => void> = new Map();
  private _initialized = false;
  private _initializing = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the coordinator: connect to Tier 1 streams and
   * prefetch initial REST data.
   */
  async initialize(): Promise<void> {
    if (this._initialized || this._initializing) return;
    this._initializing = true;

    try {
      const manager = getWSManager();
      await manager.initialize();

      // Prefetch initial data for Tier 1 symbols via REST
      await this._prefetchInitialData();

      // Subscribe to Tier 1 WebSocket streams (always-on)
      for (const symbol of TIER1_SYMBOLS) {
        this._ensureStreams(symbol, ['1m', '1h'], ['kline', 'funding', 'liquidation']);
      }

      // Subscribe to all-tickers for screener
      const key = 'allTickers';
      if (!this.activeUnsubscribers.has(key)) {
        const unsub = manager.subscribeAllTickers();
        this.activeUnsubscribers.set(key, unsub);
      }

      // Start heartbeat for SSE clients
      this.heartbeatInterval = setInterval(() => {
        const manager = getWSManager();
        for (const client of this._getClients()) {
          try {
            client.send('heartbeat', { timestamp: Date.now() });
          } catch { /* client disconnected */ }
        }
      }, 15_000);

      this._initialized = true;
      console.log('[StreamCoordinator] Initialized with Tier 1 streams');
    } catch (err) {
      console.error('[StreamCoordinator] Init error:', err);
    } finally {
      this._initializing = false;
    }
  }

  /**
   * Register an SSE client and ensure its requested streams are active.
   */
  registerClient(client: SSEClient): void {
    const manager = getWSManager();
    manager.registerSSEClient(client);

    // Ensure streams for client's symbols
    for (const symbol of client.symbols) {
      this._ensureStreams(symbol, client.intervals, client.channels);
    }
  }

  /**
   * Unregister an SSE client.
   * Streams will be cleaned up via the WS Manager's grace period.
   */
  unregisterClient(clientId: string): void {
    const manager = getWSManager();
    manager.unregisterSSEClient(clientId);
  }

  /**
   * Send initial cached data snapshot to a newly connected client.
   */
  async sendInitialSnapshot(client: SSEClient): Promise<void> {
    const cache = getMarketDataCache();

    for (const symbol of client.symbols) {
      // Send cached klines
      if (client.channels.includes('kline')) {
        for (const interval of client.intervals) {
          const klines = cache.getKlines(symbol, interval);
          if (klines.length > 0) {
            // Send the last candle as initial state
            client.send('kline', klines[klines.length - 1]);
          }
        }
      }

      // Send cached ticker
      if (client.channels.includes('ticker')) {
        const ticker = cache.getLatestTicker(symbol);
        if (ticker) client.send('ticker', ticker);
      }

      // Send cached funding rate
      if (client.channels.includes('funding')) {
        const funding = cache.getFundingRate(symbol);
        if (funding) client.send('funding', funding);
      }

      // Send cached OI
      if (client.channels.includes('openInterest')) {
        const oi = cache.getOpenInterest(symbol);
        if (oi) client.send('openInterest', oi);
      }

      // Send recent liquidations
      if (client.channels.includes('liquidation')) {
        const liqs = cache.getLiquidations(symbol);
        for (const liq of liqs.slice(-10)) {
          client.send('liquidation', liq);
        }
      }
    }
  }

  /**
   * Shutdown all streams.
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const unsub of this.activeUnsubscribers.values()) {
      try { unsub(); } catch { /* ignore */ }
    }
    this.activeUnsubscribers.clear();
    getWSManager().shutdown();
    this._initialized = false;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  // ── Private ──

  private _ensureStreams(
    symbol: string,
    intervals: string[],
    channels: string[]
  ): void {
    const manager = getWSManager();

    if (channels.includes('kline')) {
      for (const interval of intervals) {
        const key = `kline:${symbol}:${interval}`;
        if (!this.activeUnsubscribers.has(key)) {
          const unsub = manager.subscribeKline(symbol, interval);
          this.activeUnsubscribers.set(key, unsub);
        }
      }
    }

    if (channels.includes('funding')) {
      const key = `markPrice:${symbol}`;
      if (!this.activeUnsubscribers.has(key)) {
        const unsub = manager.subscribeMarkPrice(symbol);
        this.activeUnsubscribers.set(key, unsub);
      }
    }

    if (channels.includes('liquidation')) {
      const key = `liquidation:${symbol}`;
      if (!this.activeUnsubscribers.has(key)) {
        const unsub = manager.subscribeLiquidation(symbol);
        this.activeUnsubscribers.set(key, unsub);
      }
    }
  }

  private async _prefetchInitialData(): Promise<void> {
    const cache = getMarketDataCache();

    // Each call falls through [binance → bybit → okx] so a geo-blocked primary
    // doesn't wipe out the whole prefetch. Per-symbol work is allSettled so one
    // symbol's failure still leaves the rest warm.
    try {
      const tickers = await tryExchanges((ex) => ex.get24hrTicker(), 'prefetch tickers');
      tickers.forEach((t) => cache.setLatestTicker(t.symbol, t));
    } catch (err) {
      console.warn('[StreamCoordinator] ticker prefetch skipped:', err);
    }

    await Promise.allSettled(
      TIER1_SYMBOLS.map(async (symbol) => {
        try {
          const klines = await tryExchanges(
            (ex) => ex.getKlines(symbol, '1h', 500),
            `prefetch klines ${symbol} 1h`
          );
          cache.setKlines(symbol, '1h', klines);
        } catch (err) {
          console.warn(`[StreamCoordinator] ${symbol} 1h klines skipped:`, err);
        }
        try {
          const klines1m = await tryExchanges(
            (ex) => ex.getKlines(symbol, '1m', 500),
            `prefetch klines ${symbol} 1m`
          );
          cache.setKlines(symbol, '1m', klines1m);
        } catch (err) {
          console.warn(`[StreamCoordinator] ${symbol} 1m klines skipped:`, err);
        }
        try {
          const funding = await tryExchanges(
            (ex) => ex.getFundingRate(symbol),
            `prefetch funding ${symbol}`
          );
          cache.setFundingRate(symbol, funding);
        } catch (err) {
          console.warn(`[StreamCoordinator] ${symbol} funding skipped:`, err);
        }
        try {
          const oi = await tryExchanges(
            (ex) => ex.getOpenInterest(symbol),
            `prefetch OI ${symbol}`
          );
          cache.setOpenInterest(symbol, oi);
        } catch (err) {
          console.warn(`[StreamCoordinator] ${symbol} OI skipped:`, err);
        }
      })
    );

    console.log('[StreamCoordinator] Prefetched initial data');
  }

  private _getClients(): SSEClient[] {
    const manager = getWSManager();
    return Array.from(manager.getSSEClients());
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _coordinator: StreamCoordinator | null = null;

export function getStreamCoordinator(): StreamCoordinator {
  if (!_coordinator) {
    _coordinator = new StreamCoordinator();
  }
  return _coordinator;
}
