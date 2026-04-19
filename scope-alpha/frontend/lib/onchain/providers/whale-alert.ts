/**
 * Whale Alert provider — Phase 5 Slice 2.
 *
 * Real-time feed of large on-chain transfers. Free-tier constraints:
 *   - API key required (set WHALE_ALERT_API_KEY to enable; else inert)
 *   - 1 request/second hard rate limit
 *   - $500K USD minimum threshold (matches our BTC $1M / ETH $500K defaults)
 *   - ≤1h historical lookback (real-time stream only)
 *
 * Inert-mode contract: when WHALE_ALERT_API_KEY is unset, `configured` is
 * false and `fetchWhaleTransactions()` returns []. The poll-whales cron no-ops
 * and the whales API route returns an empty table + "key not configured"
 * banner in the UI.
 *
 * Classification is NOT done here — the raw from/to addresses flow through
 * to the cron, which calls lib/onchain/classify.ts against the seed list.
 */

import type {
  ExchangeFlowSeries,
  NetworkMetrics,
  OnChainAsset,
  StablecoinAggregate,
  SupplyMetrics,
  WhaleTransactionRecord,
} from '@/types/onchain';
import type { OnChainProvider, OnChainProviderCapabilities } from './types';

const BASE_URL = 'https://api.whale-alert.io/v1';
const FETCH_TIMEOUT_MS = 15_000;

// Thresholds match approved plan defaults.
const MIN_VALUE_USD: Record<OnChainAsset, number> = {
  BTC: 1_000_000,
  ETH: 500_000,
};

const CURRENCY: Record<OnChainAsset, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
};

interface WhaleAlertTransfer {
  id: string;
  hash?: string;
  blockchain?: string;
  symbol?: string;
  timestamp: number; // seconds
  amount: number;
  amount_usd: number;
  from?: { address?: string; owner?: string; owner_type?: string };
  to?: { address?: string; owner?: string; owner_type?: string };
  transaction_type?: string;
}

interface WhaleAlertResponse {
  result?: string;
  count?: number;
  transactions?: WhaleAlertTransfer[];
  error?: string;
}

export class WhaleAlertProvider implements OnChainProvider {
  readonly name = 'whale-alert';
  readonly configured: boolean;
  readonly capabilities: OnChainProviderCapabilities;

  private readonly apiKey: string | null;

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey && apiKey.length > 0 ? apiKey : null;
    this.configured = this.apiKey !== null;
    this.capabilities = {
      supply: false,
      exchangeFlows: false,
      network: false,
      stablecoins: false,
      whales: this.configured,
      sopr: false,
    };
  }

  async fetchSupplyMetrics(): Promise<SupplyMetrics | null> {
    return null;
  }
  async fetchExchangeFlows(): Promise<ExchangeFlowSeries | null> {
    return null;
  }
  async fetchNetworkMetrics(): Promise<NetworkMetrics | null> {
    return null;
  }
  async fetchStablecoinAggregate(): Promise<StablecoinAggregate | null> {
    return null;
  }

  async fetchWhaleTransactions(
    asset: OnChainAsset,
    sinceMs: number,
  ): Promise<WhaleTransactionRecord[]> {
    if (!this.configured) return [];

    // Whale Alert expects Unix seconds; free tier caps lookback at 3600s.
    const nowSec = Math.floor(Date.now() / 1000);
    const startSec = Math.max(
      Math.floor(sinceMs / 1000),
      nowSec - 3600,
    );

    const url = new URL(`${BASE_URL}/transactions`);
    url.searchParams.set('api_key', this.apiKey as string);
    url.searchParams.set('min_value', String(MIN_VALUE_USD[asset]));
    url.searchParams.set('currency', CURRENCY[asset]);
    url.searchParams.set('start', String(startSec));
    url.searchParams.set('end', String(nowSec));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        console.error(
          `[whale-alert] ${res.status} ${res.statusText} for ${asset}`,
        );
        return [];
      }
      const body = (await res.json()) as WhaleAlertResponse;
      if (body.error || !Array.isArray(body.transactions)) {
        if (body.error) console.error('[whale-alert] error:', body.error);
        return [];
      }

      return body.transactions
        .filter((t) => t.amount_usd > 0 && (t.hash || t.id))
        .map((t) => ({
          asset,
          valueUsd: t.amount_usd,
          fromAddress: t.from?.address ?? '',
          toAddress: t.to?.address ?? '',
          fromLabel: null, // Classification happens downstream in classify.ts.
          toLabel: null,
          classification: 'wallet_to_wallet' as const,
          txHash: t.hash ?? t.id,
          timestamp: new Date(t.timestamp * 1000).toISOString(),
        }));
    } catch (err) {
      console.error('[whale-alert] fetch failed:', (err as Error).message);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
