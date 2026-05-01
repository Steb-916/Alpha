import useSWR from 'swr';
import type {
  OnChainOverview,
  ExchangeFlowData,
  SupplyData,
  StablecoinFlowData,
  NetworkHealthData,
  WhaleFeedData,
  InsightCard,
} from '@/lib/onchain/types';
import type { ConvergenceScore } from '@/lib/analytics/convergence';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useOnChainOverview(asset: string) {
  const { data, error, isLoading } = useSWR<OnChainOverview>(
    `/api/market/onchain/overview?asset=${asset}`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useExchangeFlows(asset: string, days = 30) {
  const { data, error, isLoading } = useSWR<ExchangeFlowData>(
    `/api/market/onchain/exchange-flows?asset=${asset}&days=${days}`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useSupplyMetrics(asset: string) {
  const { data, error, isLoading } = useSWR<SupplyData>(
    `/api/market/onchain/supply?asset=${asset}`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useStablecoinFlows() {
  const { data, error, isLoading } = useSWR<StablecoinFlowData>(
    '/api/market/onchain/stablecoin-flows',
    fetcher,
    { refreshInterval: REFRESH_INTERVAL },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useNetworkHealth(asset: string) {
  const { data, error, isLoading } = useSWR<NetworkHealthData>(
    `/api/market/onchain/network-health?asset=${asset}`,
    fetcher,
    { refreshInterval: 60 * 60 * 1000 },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useWhaleFeed(asset: string | null, minValue = 1_000_000) {
  const assetParam = asset ? `&asset=${asset}` : '';
  const { data, error, isLoading } = useSWR<WhaleFeedData>(
    `/api/market/onchain/whale-feed?minValue=${minValue}${assetParam}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}

export function useOnChainInsights(asset: string) {
  const { data, isLoading } = useSWR<InsightCard[]>(
    `/api/market/onchain/insights?asset=${asset}`,
    fetcher,
    { refreshInterval: 15 * 60 * 1000 },
  );
  return {
    data: Array.isArray(data) ? data : [],
    isLoading,
  };
}

export function useConvergence(asset: string) {
  const { data, error, isLoading } = useSWR<ConvergenceScore>(
    `/api/market/convergence?asset=${asset}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 },
  );
  return {
    data: data && !('error' in data) ? data : null,
    isLoading,
    error: error || (data && 'error' in data ? (data as { error: string }).error : null),
  };
}
