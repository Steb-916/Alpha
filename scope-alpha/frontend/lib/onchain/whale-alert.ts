/**
 * Whale Alert API client.
 * Free tier: up to 10 req/min, transactions >= $1M, last 1 hour window.
 * Docs: https://docs.whale-alert.io/
 *
 * Falls back to mock data when WHALE_ALERT_API_KEY is not set.
 */

import type { WhaleTransaction, WhaleFeedData } from './types';

const BASE_URL = 'https://api.whale-alert.io/v1';

const SYMBOL_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
};

// Known exchange address labels from Whale Alert
const EXCHANGE_LABELS = new Set([
  'binance', 'coinbase', 'kraken', 'okx', 'bybit', 'kucoin',
  'gate.io', 'huobi', 'bitfinex', 'gemini', 'bitstamp',
]);

function classifyType(
  fromLabel: string | null,
  toLabel: string | null,
): WhaleTransaction['type'] {
  const from = (fromLabel ?? '').toLowerCase();
  const to = (toLabel ?? '').toLowerCase();
  const fromEx = EXCHANGE_LABELS.has(from);
  const toEx = EXCHANGE_LABELS.has(to);
  if (toEx && !fromEx) return 'exchange_deposit';
  if (fromEx && !toEx) return 'exchange_withdrawal';
  return 'transfer';
}

interface WhaleAlertTx {
  id: string;
  blockchain: string;
  symbol: string;
  transaction_type: string;
  hash: string;
  from: { address: string; owner?: string; owner_type?: string } | null;
  to: { address: string; owner?: string; owner_type?: string } | null;
  timestamp: number;
  amount: number;
  amount_usd: number;
}

interface WhaleAlertResponse {
  result: string;
  cursor: string;
  count: number;
  transactions: WhaleAlertTx[];
}

function mockTransactions(
  asset: string | null,
  minValueUsd: number,
): WhaleTransaction[] {
  const symbols = asset ? [asset] : ['BTC', 'ETH'];
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: 'mock-1',
      timestamp: new Date((now - 300) * 1000).toISOString(),
      symbol: symbols[0],
      amountUsd: 42_500_000,
      amountNative: symbols[0] === 'BTC' ? 500 : 12000,
      fromLabel: null,
      toLabel: 'Binance',
      type: 'exchange_deposit',
    },
    {
      id: 'mock-2',
      timestamp: new Date((now - 900) * 1000).toISOString(),
      symbol: symbols[0] === 'ETH' ? 'ETH' : 'BTC',
      amountUsd: 18_200_000,
      amountNative: symbols[0] === 'ETH' ? 5400 : 215,
      fromLabel: 'Coinbase',
      toLabel: null,
      type: 'exchange_withdrawal',
    },
    {
      id: 'mock-3',
      timestamp: new Date((now - 1800) * 1000).toISOString(),
      symbol: 'BTC',
      amountUsd: 95_000_000,
      amountNative: 1100,
      fromLabel: null,
      toLabel: null,
      type: 'transfer',
    },
  ].filter((t) => t.amountUsd >= minValueUsd);
}

export async function fetchWhaleTransactions(
  asset: string | null,
  minValueUsd = 1_000_000,
  limit = 20,
): Promise<WhaleFeedData> {
  const apiKey = process.env.WHALE_ALERT_API_KEY;

  if (!apiKey) {
    return {
      transactions: mockTransactions(asset, minValueUsd),
      minValueUsd,
      fetchedAt: new Date().toISOString(),
    };
  }

  const cursorTime = Math.floor(Date.now() / 1000) - 3600; // last 1 hour
  const params = new URLSearchParams({
    api_key: apiKey,
    min_value: String(minValueUsd),
    start: String(cursorTime),
    limit: String(limit),
  });

  if (asset && SYMBOL_MAP[asset.toUpperCase()]) {
    params.set('currency', SYMBOL_MAP[asset.toUpperCase()]);
  }

  const url = `${BASE_URL}/transactions?${params}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Whale Alert API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as WhaleAlertResponse;

  const transactions: WhaleTransaction[] = (json.transactions ?? []).map((tx) => {
    const fromLabel = tx.from?.owner ?? tx.from?.owner_type ?? null;
    const toLabel = tx.to?.owner ?? tx.to?.owner_type ?? null;
    return {
      id: tx.id || tx.hash,
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      symbol: tx.symbol.toUpperCase(),
      amountUsd: tx.amount_usd,
      amountNative: tx.amount,
      fromLabel,
      toLabel,
      type: classifyType(fromLabel, toLabel),
    };
  });

  return {
    transactions,
    minValueUsd,
    fetchedAt: new Date().toISOString(),
  };
}
