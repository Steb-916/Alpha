/**
 * Bybit WebSocket liquidation stream.
 *
 * Scope: liquidations only. Klines, tickers, funding, and OI for Bybit are
 * handled via REST polling (lib/exchanges/bybit.ts + aggregator). A full
 * WebSocketManager-equivalent for Bybit is deferred to a later phase.
 *
 * Why liquidations-only: Bybit exposes no public REST liquidation endpoint,
 * so the WS stream is the only source of Bybit liquidation data.
 *
 * Endpoint: wss://stream.bybit.com/v5/public/linear
 *
 * Bybit v5 WS protocol:
 *   - Subscribe:   {"op":"subscribe","args":["liquidation.BTCUSDT", ...]}
 *   - Ping:        {"op":"ping"} every 20s (Bybit disconnects after 60s idle)
 *   - Pong:        server responds with {"op":"pong"} (also sent unprompted
 *                  for keepalive — we just log)
 *   - Liquidation: {"topic":"liquidation.BTCUSDT","type":"snapshot","ts":...,
 *                   "data":{"updatedTime":...,"symbol":"BTCUSDT","side":"Buy",
 *                   "size":"0.003","price":"23300.00"}}
 *
 * Side mapping (from Bybit docs):
 *   "Buy"  → liquidation order buying-to-close a SHORT position → side: "short"
 *   "Sell" → liquidation order selling-to-close a LONG position  → side: "long"
 */

import WebSocket from 'ws';
import type { Liquidation } from '@/lib/exchanges/types';
import { recordLiquidation } from './liquidation-bridge';

const WS_URL =
  process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/linear';

const PING_INTERVAL_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export class BybitLiquidationStream {
  private ws: WebSocket | null = null;
  private symbols: string[] = [];
  private reconnectAttempts = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  /**
   * Connect and subscribe to liquidation streams for the given symbols
   * (e.g., ['BTCUSDT', 'ETHUSDT', ...]).
   */
  connect(symbols: string[]): void {
    this.symbols = symbols;
    this.intentionallyClosed = false;
    if (this.ws) {
      return; // Already connected or connecting
    }

    console.log(
      `[bybit-ws] connecting to ${WS_URL} (${symbols.length} symbols)`,
    );

    try {
      this.ws = new WebSocket(WS_URL);
    } catch (err) {
      console.warn('[bybit-ws] constructor threw:', (err as Error).message);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      console.log(`[bybit-ws] connected, subscribing ${symbols.length} streams`);
      this.sendSubscribe();
      this.startPing();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        console.warn('[bybit-ws] parse error:', (err as Error).message);
      }
    });

    this.ws.on('error', (err: Error) => {
      console.warn('[bybit-ws] error:', err.message);
    });

    this.ws.on('close', () => {
      console.log('[bybit-ws] closed');
      this.stopPing();
      this.ws = null;
      if (!this.intentionallyClosed) {
        this.scheduleReconnect();
      }
    });
  }

  disconnect(): void {
    this.intentionallyClosed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* no-op */
      }
      this.ws = null;
    }
  }

  private sendSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const args = this.symbols.map((s) => `liquidation.${s.toUpperCase()}`);
    this.ws.send(JSON.stringify({ op: 'subscribe', args }));
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ op: 'ping' }));
    } catch (err) {
      console.warn('[bybit-ws] ping send failed:', (err as Error).message);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `[bybit-ws] max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`,
      );
      return;
    }
    this.reconnectAttempts++;
    const backoff = Math.min(
      BASE_BACKOFF_MS * 2 ** (this.reconnectAttempts - 1),
      MAX_BACKOFF_MS,
    );
    console.log(
      `[bybit-ws] reconnecting in ${backoff}ms (attempt ${this.reconnectAttempts})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.symbols);
    }, backoff);
  }

  private handleMessage(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as Record<string, unknown>;

    // Subscribe confirmation / pong — log quietly and move on.
    if (m.op === 'subscribe' || m.op === 'pong') {
      return;
    }

    // Liquidation event.
    const topic = typeof m.topic === 'string' ? m.topic : '';
    if (topic.startsWith('liquidation.')) {
      this.handleLiquidation(m);
      return;
    }
  }

  private handleLiquidation(msg: Record<string, unknown>): void {
    const data = msg.data as
      | {
          symbol?: string;
          side?: 'Buy' | 'Sell';
          size?: string | number;
          price?: string | number;
          updatedTime?: number;
        }
      | undefined;
    if (!data || !data.symbol || !data.side || !data.size || !data.price) {
      return;
    }

    const side: Liquidation['side'] = data.side === 'Buy' ? 'short' : 'long';
    const quantity =
      typeof data.size === 'number' ? data.size : parseFloat(data.size);
    const price =
      typeof data.price === 'number' ? data.price : parseFloat(data.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price)) return;

    const liq: Liquidation = {
      symbol: data.symbol,
      exchange: 'bybit',
      side,
      price,
      quantity,
      timestamp: data.updatedTime ?? Date.now(),
    };

    recordLiquidation(liq);
  }
}

// ─── Module-level singleton ──────────────────────────────────────────────────

let instance: BybitLiquidationStream | null = null;

export function getBybitLiquidationStream(): BybitLiquidationStream {
  if (!instance) {
    instance = new BybitLiquidationStream();
  }
  return instance;
}
