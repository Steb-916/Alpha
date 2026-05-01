/**
 * CoinMetrics Community API client.
 * Docs: https://docs.coinmetrics.io/api/v4
 *
 * Free community tier provides BTC/ETH on-chain metrics:
 * - CapMrktCurUSD  → market cap
 * - CapRealUSD     → realized cap  (MVRV = CapMrktCurUSD / CapRealUSD)
 * - SOPR           → Spent Output Profit Ratio
 * - NVTAdj         → NVT ratio (adjusted)
 * - AdrActCnt      → active addresses
 * - SplyFF         → free-float supply
 * - FlowInExNtv    → exchange inflow (native)
 * - FlowOutExNtv   → exchange outflow (native)
 */

import type {
  OnChainOverview,
  ExchangeFlowData,
  ExchangeFlowPoint,
  SupplyData,
  SupplyPoint,
  StablecoinFlowData,
  StablecoinFlowPoint,
  NetworkHealthData,
  NetworkHealthPoint,
  CoinMetricsResponse,
  CoinMetricsTimeseriesItem,
} from './types';

const BASE_URL = 'https://community-api.coinmetrics.io/v4';

// Map our asset names to CoinMetrics asset IDs
const ASSET_MAP: Record<string, string> = {
  BTC: 'btc',
  ETH: 'eth',
  USDT: 'usdt',
  USDC: 'usdc',
};

async function fetchMetrics(
  asset: string,
  metrics: string[],
  startTime: string,
  endTime?: string,
  frequency = '1d',
): Promise<CoinMetricsTimeseriesItem[]> {
  const cmAsset = ASSET_MAP[asset.toUpperCase()];
  if (!cmAsset) throw new Error(`Unsupported asset: ${asset}`);

  const params = new URLSearchParams({
    assets: cmAsset,
    metrics: metrics.join(','),
    frequency,
    start_time: startTime,
    ...(endTime ? { end_time: endTime } : {}),
    page_size: '365',
  });

  const apiKey = process.env.COINMETRICS_API_KEY;
  if (apiKey && apiKey !== 'community') {
    params.set('api_key', apiKey);
  }

  const url = `${BASE_URL}/timeseries/asset-metrics?${params}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`CoinMetrics API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as CoinMetricsResponse;
  return json.data ?? [];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

function mvrvSignal(z: number | null): OnChainOverview['mvrvSignal'] {
  if (z === null) return null;
  if (z > 3.0) return 'overvalued';
  if (z < 0) return 'undervalued';
  return 'fair';
}

function soprSignal(v: number | null): OnChainOverview['soprSignal'] {
  if (v === null) return null;
  if (v > 1.02) return 'profit';
  if (v < 0.98) return 'loss';
  return 'neutral';
}

function nvtSignalFn(v: number | null): OnChainOverview['nvtSignal'] {
  if (v === null) return null;
  if (v > 65) return 'overvalued';
  if (v < 27) return 'undervalued';
  return 'fair';
}

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function fetchOnChainOverview(asset: string): Promise<OnChainOverview> {
  const startTime = daysAgo(90);
  const metrics = ['CapMrktCurUSD', 'CapRealUSD', 'SOPR', 'NVTAdj', 'AdrActCnt'];

  const rows = await fetchMetrics(asset, metrics, startTime);

  // Use the most recent row
  const latest = rows[rows.length - 1] ?? null;

  if (!latest) {
    return {
      asset,
      timestamp: new Date().toISOString(),
      mvrvZScore: null,
      mvrvSignal: null,
      sopr: null,
      soprSignal: null,
      nvtRatio: null,
      nvtSignal: null,
      activeAddresses: null,
      supplyOnExchanges: null,
      realizedCap: null,
      marketCap: null,
    };
  }

  const marketCap = parseNum(latest['CapMrktCurUSD']);
  const realizedCap = parseNum(latest['CapRealUSD']);

  // Compute MVRV z-score from rolling series
  let mvrvZScore: number | null = null;
  if (rows.length >= 30 && marketCap !== null && realizedCap !== null) {
    const mvrvSeries = rows
      .map((r) => {
        const mc = parseNum(r['CapMrktCurUSD']);
        const rc = parseNum(r['CapRealUSD']);
        return mc !== null && rc !== null && rc > 0 ? mc / rc : null;
      })
      .filter((v): v is number => v !== null);

    if (mvrvSeries.length >= 30) {
      const mean = mvrvSeries.reduce((a, b) => a + b, 0) / mvrvSeries.length;
      const std = Math.sqrt(
        mvrvSeries.reduce((a, b) => a + (b - mean) ** 2, 0) / mvrvSeries.length,
      );
      const currentMVRV = realizedCap > 0 ? marketCap / realizedCap : null;
      mvrvZScore = currentMVRV !== null && std > 0 ? (currentMVRV - mean) / std : null;
    }
  }

  const sopr = parseNum(latest['SOPR']);
  const nvtRatio = parseNum(latest['NVTAdj']);
  const activeAddresses = parseNum(latest['AdrActCnt']);

  return {
    asset,
    timestamp: latest.time,
    mvrvZScore,
    mvrvSignal: mvrvSignal(mvrvZScore),
    sopr,
    soprSignal: soprSignal(sopr),
    nvtRatio,
    nvtSignal: nvtSignalFn(nvtRatio),
    activeAddresses,
    supplyOnExchanges: null, // requires paid tier
    realizedCap,
    marketCap,
  };
}

export async function fetchExchangeFlows(
  asset: string,
  days: number,
): Promise<ExchangeFlowData> {
  const startTime = daysAgo(days + 1);
  const metrics = ['FlowInExNtv', 'FlowOutExNtv', 'PriceUSD'];

  const rows = await fetchMetrics(asset, metrics, startTime);

  const points: ExchangeFlowPoint[] = rows.map((r) => {
    const inflowNative = parseNum(r['FlowInExNtv']) ?? 0;
    const outflowNative = parseNum(r['FlowOutExNtv']) ?? 0;
    const price = parseNum(r['PriceUSD']);
    return {
      timestamp: r.time,
      inflowNative,
      outflowNative,
      netFlowNative: inflowNative - outflowNative,
      inflowUsd: price !== null ? inflowNative * price : null,
      outflowUsd: price !== null ? outflowNative * price : null,
      netFlowUsd: price !== null ? (inflowNative - outflowNative) * price : null,
    };
  });

  const totalNet = points.reduce((s, p) => s + p.netFlowNative, 0);
  const totalNetUsd = points.reduce((s, p) => {
    if (p.netFlowUsd === null) return s;
    return (s ?? 0) + p.netFlowUsd;
  }, null as number | null);

  return {
    asset,
    days,
    points,
    summary: {
      totalNetFlowNative: totalNet,
      totalNetFlowUsd: totalNetUsd,
      trend: totalNet > 0 ? 'distribution' : totalNet < 0 ? 'accumulation' : 'neutral',
    },
  };
}

export async function fetchSupplyMetrics(asset: string): Promise<SupplyData> {
  const startTime = daysAgo(90);
  const metrics = ['CapMrktCurUSD', 'CapRealUSD'];

  const rows = await fetchMetrics(asset, metrics, startTime);

  const history: SupplyPoint[] = rows.map((r) => {
    const mc = parseNum(r['CapMrktCurUSD']);
    const rc = parseNum(r['CapRealUSD']);
    return {
      timestamp: r.time,
      supplyOnExchanges: null,
      realizedCap: rc,
      marketCap: mc,
    };
  });

  const latest = history[history.length - 1];
  const mc = latest?.marketCap ?? null;
  const rc = latest?.realizedCap ?? null;

  return {
    asset,
    current: {
      supplyOnExchanges: null,
      realizedCap: rc,
      marketCap: mc,
      mvrvRatio: mc !== null && rc !== null && rc > 0 ? mc / rc : null,
    },
    history,
  };
}

export async function fetchNetworkHealth(asset: string): Promise<NetworkHealthData> {
  const startTime = daysAgo(30);
  // HashRate is available in CoinMetrics community for BTC
  // TxCnt + FeeMeanNtv available for both BTC and ETH
  const btcMetrics = ['HashRate', 'TxCnt', 'FeeMeanNtv', 'PriceUSD'];
  const ethMetrics = ['TxCnt', 'FeeMeanNtv', 'PriceUSD'];
  const metrics = asset.toUpperCase() === 'BTC' ? btcMetrics : ethMetrics;

  const rows = await fetchMetrics(asset, metrics, startTime);

  const history: NetworkHealthPoint[] = rows.map((r) => {
    const price = parseNum(r['PriceUSD']);
    const feeBtc = parseNum(r['FeeMeanNtv']);
    return {
      timestamp: r.time,
      hashRate: parseNum(r['HashRate']),
      txCount: parseNum(r['TxCnt']),
      avgFeeBtc: feeBtc,
      avgFeeUsd: feeBtc !== null && price !== null ? feeBtc * price : null,
    };
  });

  const latest = history[history.length - 1];
  return {
    asset,
    current: {
      hashRate: latest?.hashRate ?? null,
      txCount: latest?.txCount ?? null,
      avgFeeUsd: latest?.avgFeeUsd ?? null,
    },
    history,
  };
}

export async function fetchStablecoinFlows(): Promise<StablecoinFlowData> {
  const startTime = daysAgo(30);
  const metrics = ['FlowInExNtv', 'FlowOutExNtv'];

  const [usdtRows, usdcRows] = await Promise.all([
    fetchMetrics('USDT', metrics, startTime).catch(() => [] as CoinMetricsTimeseriesItem[]),
    fetchMetrics('USDC', metrics, startTime).catch(() => [] as CoinMetricsTimeseriesItem[]),
  ]);

  // Align by timestamp
  const usdtMap = new Map(usdtRows.map((r) => [r.time, r]));
  const allTimes = Array.from(
    new Set([...usdtRows.map((r) => r.time), ...usdcRows.map((r) => r.time)]),
  ).sort();

  const points: StablecoinFlowPoint[] = allTimes.map((t) => {
    const ut = usdtMap.get(t);
    const uc = usdcRows.find((r) => r.time === t);

    const usdtIn = parseNum(ut?.['FlowInExNtv']) ?? 0;
    const usdtOut = parseNum(ut?.['FlowOutExNtv']) ?? 0;
    const usdcIn = parseNum(uc?.['FlowInExNtv']) ?? 0;
    const usdcOut = parseNum(uc?.['FlowOutExNtv']) ?? 0;

    return {
      timestamp: t,
      usdtNetFlowNative: usdtIn - usdtOut,
      usdcNetFlowNative: usdcIn - usdcOut,
      combinedNetFlowUsd: (usdtIn - usdtOut) + (usdcIn - usdcOut), // both are in USD-equivalent native
    };
  });

  const last7 = points.slice(-7);
  const usdtNet7d = last7.reduce((s, p) => s + p.usdtNetFlowNative, 0);
  const usdcNet7d = last7.reduce((s, p) => s + p.usdcNetFlowNative, 0);
  const combined7d = usdtNet7d + usdcNet7d;

  return {
    points,
    summary: {
      usdtNetFlow7d: usdtNet7d,
      usdcNetFlow7d: usdcNet7d,
      combinedNetFlow7d: combined7d,
      trend: combined7d > 1e6 ? 'inflow' : combined7d < -1e6 ? 'outflow' : 'neutral',
    },
  };
}
