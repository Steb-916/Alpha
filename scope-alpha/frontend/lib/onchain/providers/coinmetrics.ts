/**
 * CoinMetrics Community API provider — Phase 5 primary source.
 *
 * Free-tier availability (verified via /v4/catalog-v2/asset-metrics):
 *   BTC: CapMVRVCur, CapMrktCurUSD, FlowInExUSD, FlowOutExUSD, AdrActCnt,
 *        TxCnt, TxTfrCnt, FeeTotNtv, HashRate, SplyCur, IssTotUSD, PriceUSD
 *   ETH: CapMVRVCur, CapMrktCurUSD, FlowInExUSD, FlowOutExUSD, AdrActCnt,
 *        TxCnt, TxTfrCnt, SplyCur, PriceUSD
 *
 * NOT available on community tier (Slice 2 fallback via public-chain provider):
 *   CapRealUSD (realized cap), SOPR, per-exchange breakdown, NVT-Adj variants.
 *
 * Single-fetch confirmed: 4y daily × 5 metrics returns 1,478 rows in one
 * response with `next_page_token: null`. No pagination handling needed for
 * the daily-frequency requests this provider makes.
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

const BASE_URL = 'https://community-api.coinmetrics.io/v4';
const FETCH_TIMEOUT_MS = 15_000;

const CAPABILITIES: OnChainProviderCapabilities = {
  supply: true,
  exchangeFlows: true,
  network: true,
  stablecoins: false,
  whales: false,
  sopr: false,
};

interface CoinMetricsRow {
  asset: string;
  time: string;
  [metric: string]: string | undefined;
}

interface CoinMetricsResponse {
  data?: CoinMetricsRow[];
  next_page_token?: string | null;
  error?: { type: string; message: string };
}

function toNumberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`[coinmetrics] ${res.status} ${res.statusText} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error('[coinmetrics] fetch failed:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function startTimeForLookback(lookbackDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return d.toISOString().slice(0, 10);
}

function endTimeToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export class CoinMetricsProvider implements OnChainProvider {
  readonly name = 'coinmetrics';
  readonly configured = true;
  readonly capabilities = CAPABILITIES;

  private readonly apiKey: string | null;

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey ?? null;
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (this.apiKey) url.searchParams.set('api_key', this.apiKey);
    return url.toString();
  }

  async fetchSupplyMetrics(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<SupplyMetrics | null> {
    const url = this.buildUrl('/timeseries/asset-metrics', {
      assets: asset.toLowerCase(),
      metrics: 'CapMVRVCur,CapMrktCurUSD,SplyCur,PriceUSD',
      start_time: startTimeForLookback(lookbackDays),
      end_time: endTimeToday(),
      frequency: '1d',
      page_size: '10000',
    });
    const res = await fetchJSON<CoinMetricsResponse>(url);
    if (!res || res.error || !Array.isArray(res.data)) return null;

    return {
      asset,
      series: res.data.map((row) => ({
        timestamp: row.time,
        mvrv: toNumberOrNull(row['CapMVRVCur']),
        marketCapUsd: toNumberOrNull(row['CapMrktCurUSD']),
        supplyNative: toNumberOrNull(row['SplyCur']),
        priceUsd: toNumberOrNull(row['PriceUSD']),
      })),
    };
  }

  async fetchExchangeFlows(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<ExchangeFlowSeries | null> {
    const url = this.buildUrl('/timeseries/asset-metrics', {
      assets: asset.toLowerCase(),
      metrics: 'FlowInExUSD,FlowOutExUSD',
      start_time: startTimeForLookback(lookbackDays),
      end_time: endTimeToday(),
      frequency: '1d',
      page_size: '10000',
    });
    const res = await fetchJSON<CoinMetricsResponse>(url);
    if (!res || res.error || !Array.isArray(res.data)) return null;

    return {
      asset,
      series: res.data.map((row) => {
        const inflow = toNumberOrNull(row['FlowInExUSD']) ?? 0;
        const outflow = toNumberOrNull(row['FlowOutExUSD']) ?? 0;
        return {
          timestamp: row.time,
          exchange: 'aggregate',
          inflowUsd: inflow,
          outflowUsd: outflow,
          netFlowUsd: inflow - outflow,
        };
      }),
    };
  }

  async fetchNetworkMetrics(
    asset: OnChainAsset,
    lookbackDays: number,
  ): Promise<NetworkMetrics | null> {
    // BTC: AdrActCnt + TxCnt + FeeTotNtv + HashRate + IssTotUSD + PriceUSD
    //      (FeeTotNtv * PriceUSD → feesUsd)
    // ETH: AdrActCnt + TxCnt + IssTotUSD
    //      (no FeeTot* or HashRate on community tier for ETH)
    const btcExtra = asset === 'BTC' ? ',FeeTotNtv,HashRate,PriceUSD' : '';
    const url = this.buildUrl('/timeseries/asset-metrics', {
      assets: asset.toLowerCase(),
      metrics: `AdrActCnt,TxCnt,IssTotUSD${btcExtra}`,
      start_time: startTimeForLookback(lookbackDays),
      end_time: endTimeToday(),
      frequency: '1d',
      page_size: '10000',
    });
    const res = await fetchJSON<CoinMetricsResponse>(url);
    if (!res || res.error || !Array.isArray(res.data)) return null;

    return {
      asset,
      series: res.data.map((row) => {
        const feeNative = toNumberOrNull(row['FeeTotNtv']);
        const priceUsd = toNumberOrNull(row['PriceUSD']);
        const feesUsd =
          feeNative != null && priceUsd != null ? feeNative * priceUsd : null;
        return {
          timestamp: row.time,
          activeAddresses: toNumberOrNull(row['AdrActCnt']),
          txCount: toNumberOrNull(row['TxCnt']),
          feesUsd,
          issuanceUsd: toNumberOrNull(row['IssTotUSD']),
          hashRate: toNumberOrNull(row['HashRate']),
        };
      }),
    };
  }

  async fetchStablecoinAggregate(): Promise<StablecoinAggregate | null> {
    return null;
  }

  async fetchWhaleTransactions(): Promise<WhaleTransactionRecord[]> {
    return [];
  }
}
