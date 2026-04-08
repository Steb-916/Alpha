/**
 * Supported asset configuration for the live data layer.
 *
 * This is the single source of truth for which symbols Scope Alpha tracks.
 * Adding a new asset is a one-line change here — the screener cron, the
 * aggregator, and the mock generators all read from this list.
 */

export interface AssetConfig {
  /** Internal app symbol (used by useAppStore.selectedAsset) */
  symbol: string;
  /** Display name */
  name: string;
  /** Binance USDT-M futures symbol */
  binance: string;
  /** Bybit linear perpetual symbol */
  bybit: string;
  /** Coingecko / fundamentals rank, used as default sort */
  rank: number;
}

export const SUPPORTED_ASSETS: AssetConfig[] = [
  { symbol: 'BTC',   name: 'Bitcoin',     binance: 'BTCUSDT',   bybit: 'BTCUSDT',   rank: 1 },
  { symbol: 'ETH',   name: 'Ethereum',    binance: 'ETHUSDT',   bybit: 'ETHUSDT',   rank: 2 },
  { symbol: 'BNB',   name: 'BNB',         binance: 'BNBUSDT',   bybit: 'BNBUSDT',   rank: 3 },
  { symbol: 'SOL',   name: 'Solana',      binance: 'SOLUSDT',   bybit: 'SOLUSDT',   rank: 4 },
  { symbol: 'XRP',   name: 'XRP',         binance: 'XRPUSDT',   bybit: 'XRPUSDT',   rank: 5 },
  { symbol: 'DOGE',  name: 'Dogecoin',    binance: 'DOGEUSDT',  bybit: 'DOGEUSDT',  rank: 6 },
  { symbol: 'ADA',   name: 'Cardano',     binance: 'ADAUSDT',   bybit: 'ADAUSDT',   rank: 7 },
  { symbol: 'AVAX',  name: 'Avalanche',   binance: 'AVAXUSDT',  bybit: 'AVAXUSDT',  rank: 8 },
  { symbol: 'DOT',   name: 'Polkadot',    binance: 'DOTUSDT',   bybit: 'DOTUSDT',   rank: 9 },
  { symbol: 'LINK',  name: 'Chainlink',   binance: 'LINKUSDT',  bybit: 'LINKUSDT',  rank: 10 },
  { symbol: 'MATIC', name: 'Polygon',     binance: 'MATICUSDT', bybit: 'MATICUSDT', rank: 11 },
  { symbol: 'LTC',   name: 'Litecoin',    binance: 'LTCUSDT',   bybit: 'LTCUSDT',   rank: 12 },
  { symbol: 'ARB',   name: 'Arbitrum',    binance: 'ARBUSDT',   bybit: 'ARBUSDT',   rank: 13 },
  { symbol: 'OP',    name: 'Optimism',    binance: 'OPUSDT',    bybit: 'OPUSDT',    rank: 14 },
  { symbol: 'APT',   name: 'Aptos',       binance: 'APTUSDT',   bybit: 'APTUSDT',   rank: 15 },
];

export const SYMBOLS = SUPPORTED_ASSETS.map((a) => a.symbol);

export function getAsset(symbol: string): AssetConfig | undefined {
  return SUPPORTED_ASSETS.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}

/** Resolve any user-supplied symbol (BTC, BTCUSDT, btc) to its canonical config. */
export function resolveAsset(symbol: string): AssetConfig | undefined {
  const norm = symbol.toUpperCase().replace(/USDT$/, '');
  return getAsset(norm);
}
