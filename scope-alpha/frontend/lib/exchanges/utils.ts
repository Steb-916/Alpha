/**
 * Exchange utility functions for symbol normalization and interval mapping.
 */

import type { StandardInterval } from './types';

// ─── Interval Mapping ───────────────────────────────────────────────────────

/** Map app timeframe codes to Binance kline intervals */
const APP_TO_BINANCE_INTERVAL: Record<string, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1H': '1h',
  '1h': '1h',
  '2h': '2h',
  '4H': '4h',
  '4h': '4h',
  '6h': '6h',
  '8h': '8h',
  '12h': '12h',
  '1D': '1d',
  '1d': '1d',
  '3d': '3d',
  '1W': '1w',
  '1w': '1w',
  '1M': '1M',
};

export function toBinanceInterval(appInterval: string): string {
  return APP_TO_BINANCE_INTERVAL[appInterval] || appInterval.toLowerCase();
}

/** Map Binance intervals back to standard intervals */
export function fromBinanceInterval(binanceInterval: string): StandardInterval {
  const map: Record<string, StandardInterval> = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
    '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
  };
  return map[binanceInterval] || '1m';
}

// ─── Symbol Normalization ───────────────────────────────────────────────────

/**
 * Convert app-level asset name to Binance futures symbol.
 * "BTC" → "BTCUSDT", "BTCUSDT" → "BTCUSDT"
 */
export function toBinanceSymbol(asset: string): string {
  const upper = asset.toUpperCase();
  if (upper.endsWith('USDT')) return upper;
  return upper + 'USDT';
}

/**
 * Extract base asset from a full symbol.
 * "BTCUSDT" → "BTC", "ETHUSDT" → "ETH"
 */
export function toBaseAsset(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.endsWith('USDT')) return upper.slice(0, -4);
  return upper;
}

// ─── Interval Durations (ms) ────────────────────────────────────────────────

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000, // Approximate (30 days)
};

export function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval.toLowerCase()] || INTERVAL_MS[toBinanceInterval(interval)] || 60_000;
}
