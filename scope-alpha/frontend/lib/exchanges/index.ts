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
 * Get all enabled exchange connectors, ordered by preference.
 *
 * Default: Binance → Bybit → OKX. The route-level fallback iterates this list
 * on failure. OKX is the safety net for geos where Binance futures REST is
 * geo-blocked (e.g. US 451) since its public endpoints work worldwide.
 *
 * Env toggles:
 *   DISABLE_BYBIT=true  drop Bybit from the chain
 *   DISABLE_OKX=true    drop OKX from the chain
 */
export function getEnabledExchanges(): ExchangeConnector[] {
  const exchanges: ExchangeConnector[] = [getExchange('binance')];
  if (process.env.DISABLE_BYBIT !== 'true') exchanges.push(getExchange('bybit'));
  if (process.env.DISABLE_OKX !== 'true') exchanges.push(getExchange('okx'));
  return exchanges;
}

/**
 * Call `op` against each enabled exchange in order until one returns. Throws
 * the last error if all exchanges fail. Logs each failure so geo-blocks are
 * visible in the server log.
 */
export async function tryExchanges<T>(
  op: (exchange: ExchangeConnector) => Promise<T>,
  context: string
): Promise<T> {
  const exchanges = getEnabledExchanges();
  let lastErr: unknown = new Error('no exchanges enabled');
  for (const exchange of exchanges) {
    try {
      return await op(exchange);
    } catch (err) {
      lastErr = err;
      console.warn(
        `[exchanges] ${context} via ${exchange.name} failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
  throw lastErr;
}

// Re-export types and utilities
export * from './types';
export * from './utils';
