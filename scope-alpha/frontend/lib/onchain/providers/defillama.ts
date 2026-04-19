/**
 * DefiLlama stablecoins provider — Phase 5 Slice 2.
 *
 * Free, no API key required. Two endpoints we care about:
 *   - /stablecoins?includePrices=false — current circulating + prevDay/Week/Month
 *     per stablecoin. Use to derive the USDT/USDC/DAI current snapshot.
 *   - /stablecoincharts/all — aggregate daily history (3,063+ points, single
 *     fetch, no pagination). Use for the chart series.
 *
 * Implements only `fetchStablecoinAggregate()`. Other provider methods return
 * null/[] — each concern has its own provider.
 */

import type {
  ExchangeFlowSeries,
  NetworkMetrics,
  OnChainAsset,
  StablecoinAggregate,
  StablecoinChartPoint,
  SupplyMetrics,
  WhaleTransactionRecord,
} from '@/types/onchain';
import type { OnChainProvider, OnChainProviderCapabilities } from './types';

const BASE_URL = 'https://stablecoins.llama.fi';
const FETCH_TIMEOUT_MS = 15_000;

const CAPABILITIES: OnChainProviderCapabilities = {
  supply: false,
  exchangeFlows: false,
  network: false,
  stablecoins: true,
  whales: false,
  sopr: false,
};

interface LlamaPegged {
  id: string;
  symbol: string;
  circulating?: { peggedUSD?: number };
  circulatingPrevDay?: { peggedUSD?: number };
  circulatingPrevWeek?: { peggedUSD?: number };
  circulatingPrevMonth?: { peggedUSD?: number };
}

interface LlamaStablecoinsResponse {
  peggedAssets: LlamaPegged[];
}

interface LlamaChartPoint {
  date: string; // Unix timestamp as string
  totalCirculatingUSD?: { peggedUSD?: number };
  totalCirculating?: { peggedUSD?: number };
}

async function fetchJSON<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      console.error(`[defillama] ${res.status} ${res.statusText} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error('[defillama] fetch failed:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function unixToIso(unix: string): string {
  const ts = Number(unix);
  if (!Number.isFinite(ts)) return new Date().toISOString();
  return new Date(ts * 1000).toISOString();
}

export class DefiLlamaProvider implements OnChainProvider {
  readonly name = 'defillama';
  readonly configured = true;
  readonly capabilities = CAPABILITIES;

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
    const res = await fetchJSON<LlamaStablecoinsResponse>(
      `${BASE_URL}/stablecoins?includePrices=false`,
    );
    if (!res || !Array.isArray(res.peggedAssets)) return null;

    const bySymbol = new Map<string, LlamaPegged>();
    for (const p of res.peggedAssets) {
      if (p.symbol) bySymbol.set(p.symbol.toUpperCase(), p);
    }

    const usdt = bySymbol.get('USDT');
    const usdc = bySymbol.get('USDC');
    const dai = bySymbol.get('DAI');

    const usdtUsd = usdt?.circulating?.peggedUSD ?? 0;
    const usdcUsd = usdc?.circulating?.peggedUSD ?? 0;
    const daiUsd = dai?.circulating?.peggedUSD ?? 0;
    const totalUsd = usdtUsd + usdcUsd + daiUsd;

    // Sum prev-period supplies for the three to derive a directional delta.
    const prev7d = [
      usdt?.circulatingPrevWeek?.peggedUSD,
      usdc?.circulatingPrevWeek?.peggedUSD,
      dai?.circulatingPrevWeek?.peggedUSD,
    ];
    const prev30d = [
      usdt?.circulatingPrevMonth?.peggedUSD,
      usdc?.circulatingPrevMonth?.peggedUSD,
      dai?.circulatingPrevMonth?.peggedUSD,
    ];

    const sumOrNull = (arr: (number | undefined)[]) => {
      if (arr.some((x) => x == null)) return null;
      return (arr as number[]).reduce((a, b) => a + b, 0);
    };

    return {
      timestamp: new Date().toISOString(),
      totalSupplyUsd: totalUsd,
      usdtSupplyUsd: usdtUsd,
      usdcSupplyUsd: usdcUsd,
      daiSupplyUsd: daiUsd,
      supply7dAgoUsd: sumOrNull(prev7d),
      supply30dAgoUsd: sumOrNull(prev30d),
      exchangeBalanceUsd: null,
      exchangeBalancePct: null,
    };
  }

  async fetchStablecoinChart(): Promise<StablecoinChartPoint[] | null> {
    const res = await fetchJSON<LlamaChartPoint[]>(
      `${BASE_URL}/stablecoincharts/all`,
    );
    if (!Array.isArray(res)) return null;
    return res
      .map((p) => {
        const usd = p.totalCirculatingUSD?.peggedUSD ?? p.totalCirculating?.peggedUSD;
        if (usd == null || !Number.isFinite(usd)) return null;
        return {
          timestamp: unixToIso(p.date),
          totalSupplyUsd: usd,
        };
      })
      .filter((p): p is StablecoinChartPoint => p !== null);
  }

  async fetchWhaleTransactions(): Promise<WhaleTransactionRecord[]> {
    return [];
  }
}
