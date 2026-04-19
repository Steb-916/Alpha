/**
 * On-chain provider interface — Phase 5.
 *
 * Swapping providers (free tier → Glassnode → CryptoQuant) is a config
 * change behind this interface. v1 ships CoinMetrics community as the
 * primary supply/flow/network source. DefiLlama (stablecoins) and a
 * public-chain provider (SOPR, whales) arrive in Slice 2.
 */

import type {
  ExchangeFlowSeries,
  NetworkMetrics,
  OnChainAsset,
  StablecoinAggregate,
  SupplyMetrics,
  WhaleTransactionRecord,
} from '@/types/onchain';

export interface OnChainProviderCapabilities {
  supply: boolean;
  exchangeFlows: boolean;
  network: boolean;
  stablecoins: boolean;
  whales: boolean;
  sopr: boolean;
}

export interface OnChainProvider {
  name: string;
  configured: boolean;
  capabilities: OnChainProviderCapabilities;

  fetchSupplyMetrics(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<SupplyMetrics | null>;

  fetchExchangeFlows(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<ExchangeFlowSeries | null>;

  fetchNetworkMetrics(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<NetworkMetrics | null>;

  fetchStablecoinAggregate(): Promise<StablecoinAggregate | null>;

  fetchWhaleTransactions(
    asset: OnChainAsset,
    sinceMs: number,
  ): Promise<WhaleTransactionRecord[]>;
}
