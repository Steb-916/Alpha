import useSWR from 'swr';
import type {
  OnChainOverview,
  ExchangeFlowData,
  SupplyData,
  StablecoinFlowData,
} from '@/lib/onchain/types';

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
