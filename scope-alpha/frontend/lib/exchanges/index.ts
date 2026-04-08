/**
 * Exchange registry / factory.
 * Returns singleton connector instances by name.
 */

import type { ExchangeConnector } from './types';
import { BinanceConnector } from './binance';
import { BybitConnector } from './bybit';
import { OKXConnector } from './okx';

const connectors: Map<string, ExchangeConnector> = new Map();

export function getExchange(name: string): ExchangeConnector {
  const key = name.toLowerCase();
  let connector = connectors.get(key);
  if (connector) return connector;

  switch (key) {
    case 'binance':
      connector = new BinanceConnector();
      break;
    case 'bybit':
      connector = new BybitConnector();
      break;
    case 'okx':
      connector = new OKXConnector();
      break;
    default:
      throw new Error(`Unknown exchange: ${name}`);
  }

  connectors.set(key, connector);
  return connector;
}

/** Get the primary exchange connector (Binance). */
export function getPrimaryExchange(): ExchangeConnector {
  return getExchange('binance');
}

/**
 * Get all enabled exchange connectors.
 *
 * Phase 1 default: Binance + Bybit (per user decision). OKX deferred.
 * Set DISABLE_BYBIT=true to fall back to Binance-only, or ENABLE_OKX=true
 * to opt into OKX (its REST methods are still stubs as of this commit).
 */
export function getEnabledExchanges(): ExchangeConnector[] {
  const exchanges: ExchangeConnector[] = [getExchange('binance')];
  if (process.env.DISABLE_BYBIT !== 'true') exchanges.push(getExchange('bybit'));
  if (process.env.ENABLE_OKX === 'true') exchanges.push(getExchange('okx'));
  return exchanges;
}

// Re-export types and utilities
export * from './types';
export * from './utils';
