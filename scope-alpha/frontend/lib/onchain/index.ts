/**
 * On-chain provider selector — Phase 5 (Slice 1 + Slice 2).
 *
 * Rather than a single composite wrapper, callers import the specific
 * provider they need. This keeps the intent explicit — a stablecoin route
 * never accidentally asks the CoinMetrics provider for data it can't
 * supply, and vice-versa. Each provider is a singleton cached on first
 * access.
 *
 * Swapping the on-chain provider (CoinMetrics → Glassnode / CryptoQuant)
 * is a config change via ONCHAIN_PROVIDER. The stablecoin provider is
 * fixed to DefiLlama in v1. The whale provider is fixed to Whale Alert.
 */

import { CoinMetricsProvider } from './providers/coinmetrics';
import { DefiLlamaProvider } from './providers/defillama';
import { WhaleAlertProvider } from './providers/whale-alert';
import type { OnChainProvider } from './providers/types';

let _onchain: OnChainProvider | null = null;
let _stablecoins: DefiLlamaProvider | null = null;
let _whales: WhaleAlertProvider | null = null;

/** CoinMetrics community by default — supply + flows + network metrics. */
export function getOnChainProvider(): OnChainProvider {
  if (_onchain) return _onchain;
  const choice = (process.env.ONCHAIN_PROVIDER || 'coinmetrics').toLowerCase();
  switch (choice) {
    case 'coinmetrics':
    default:
      _onchain = new CoinMetricsProvider(process.env.COINMETRICS_API_KEY || null);
      return _onchain;
  }
}

/**
 * DefiLlama — stablecoin aggregate + history. Always configured (no key
 * required).
 */
export function getStablecoinProvider(): DefiLlamaProvider {
  if (!_stablecoins) _stablecoins = new DefiLlamaProvider();
  return _stablecoins;
}

/**
 * Whale Alert — large on-chain transfers. Inert (returns []) when
 * WHALE_ALERT_API_KEY is unset.
 */
export function getWhaleProvider(): WhaleAlertProvider {
  if (!_whales) _whales = new WhaleAlertProvider(process.env.WHALE_ALERT_API_KEY || null);
  return _whales;
}

export type { OnChainProvider } from './providers/types';
