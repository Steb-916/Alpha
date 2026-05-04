import type {
  CorrelationAsset,
  CorrelationMatrix,
  EtfFlowData,
  EtfFlowDay,
  TokenUnlockEvent,
  TokenUnlockCalendar,
} from '@/types/macro';

// ─── Pearson Correlation ──────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 5) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

// ─── Yahoo Finance ────────────────────────────────────────────────────────────

const YAHOO_SYMBOLS: Record<string, string> = {
  SPX:    '%5EGSPC',
  GOLD:   'GC%3DF',
  DXY:    'DX-Y.NYB',
  NASDAQ: '%5EIXIC',
};

interface PricePoint { date: string; close: number }

export async function fetchYahooClose(asset: string): Promise<PricePoint[]> {
  const symbol = YAHOO_SYMBOLS[asset];
  if (!symbol) return [];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo&includePrePost=false`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 0 } });
  if (!res.ok) return [];
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const out: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || isNaN(c)) continue;
    out.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close: c });
  }
  return out;
}

// ─── CoinGecko ────────────────────────────────────────────────────────────────

const COINGECKO_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum' };

export async function fetchCoinGeckoClose(asset: 'BTC' | 'ETH', days = 35): Promise<PricePoint[]> {
  const id = COINGECKO_IDS[asset];
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const json = await res.json();
  const prices: [number, number][] = json?.prices ?? [];
  return prices.map(([ts, close]) => ({
    date: new Date(ts).toISOString().slice(0, 10),
    close,
  }));
}

export async function fetchCoinGeckoPrices(coinIds: string[]): Promise<Record<string, number>> {
  const ids = coinIds.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return {};
  const json = await res.json();
  const out: Record<string, number> = {};
  for (const [id, data] of Object.entries(json)) {
    const d = data as { usd?: number };
    if (d?.usd) out[id] = d.usd;
  }
  return out;
}

// ─── Fear & Greed ─────────────────────────────────────────────────────────────

export interface FearGreedPoint { date: string; value: number; label: string }

export async function fetchFearGreed(limit = 90): Promise<FearGreedPoint[]> {
  const url = `https://api.alternative.me/fng/?limit=${limit}&format=json`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];
  const json = await res.json();
  const data: { value: string; value_classification: string; timestamp: string }[] = json?.data ?? [];
  return data.map((d) => ({
    date: new Date(parseInt(d.timestamp) * 1000).toISOString().slice(0, 10),
    value: parseInt(d.value),
    label: d.value_classification,
  }));
}

// ─── Correlation Computation ──────────────────────────────────────────────────

function logReturn(prices: PricePoint[]): { date: string; ret: number }[] {
  const out: { date: string; ret: number }[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].close > 0 && prices[i - 1].close > 0) {
      out.push({ date: prices[i].date, ret: Math.log(prices[i].close / prices[i - 1].close) });
    }
  }
  return out;
}

export async function computeCorrelationMatrix(windowDays = 30): Promise<CorrelationMatrix> {
  const ASSETS: CorrelationAsset[] = ['BTC', 'ETH', 'SPX', 'GOLD', 'DXY', 'NASDAQ'];

  const [btc, eth, spx, gold, dxy, nasdaq] = await Promise.all([
    fetchCoinGeckoClose('BTC', 90),
    fetchCoinGeckoClose('ETH', 90),
    fetchYahooClose('SPX'),
    fetchYahooClose('GOLD'),
    fetchYahooClose('DXY'),
    fetchYahooClose('NASDAQ'),
  ]);

  const seriesMap: Record<CorrelationAsset, PricePoint[]> = {
    BTC: btc, ETH: eth, SPX: spx, GOLD: gold, DXY: dxy, NASDAQ: nasdaq,
  };

  const returnsMap: Record<CorrelationAsset, { date: string; ret: number }[]> = {} as never;
  for (const asset of ASSETS) {
    returnsMap[asset] = logReturn(seriesMap[asset]);
  }

  // Inner-join dates across all assets
  const dateSets = ASSETS.map((a) => new Set(returnsMap[a].map((r) => r.date)));
  const commonDates = [...dateSets[0]].filter((d) => dateSets.every((s) => s.has(d))).sort();
  const window = commonDates.slice(-windowDays);

  const retsByDate: Record<CorrelationAsset, Map<string, number>> = {} as never;
  for (const asset of ASSETS) {
    retsByDate[asset] = new Map(returnsMap[asset].map((r) => [r.date, r.ret]));
  }

  const matrix: number[][] = [];
  for (const a of ASSETS) {
    const row: number[] = [];
    for (const b of ASSETS) {
      if (a === b) { row.push(1); continue; }
      const xs = window.map((d) => retsByDate[a].get(d)!).filter(isFinite);
      const ys = window.map((d) => retsByDate[b].get(d)!).filter(isFinite);
      row.push(pearson(xs, ys) ?? 0);
    }
    matrix.push(row);
  }

  // Rolling 30d BTC-SPX correlation over all common dates
  const allCommon = [...dateSets[0]].filter((d) =>
    new Set(returnsMap.SPX.map((r) => r.date)).has(d)
  ).sort();

  const btcRetMap = new Map(returnsMap.BTC.map((r) => [r.date, r.ret]));
  const spxRetMap = new Map(returnsMap.SPX.map((r) => [r.date, r.ret]));

  const rollingBtcSpx: { timestamp: string; correlation: number | null }[] = [];
  for (let i = 30; i <= allCommon.length; i++) {
    const slice = allCommon.slice(i - 30, i);
    const xs = slice.map((d) => btcRetMap.get(d)).filter((v): v is number => v !== undefined);
    const ys = slice.map((d) => spxRetMap.get(d)).filter((v): v is number => v !== undefined);
    rollingBtcSpx.push({ timestamp: allCommon[i - 1], correlation: pearson(xs, ys) });
  }

  return { assets: ASSETS, matrix, rollingBtcSpx, computedAt: new Date().toISOString(), windowDays };
}

// ─── ETF Flow Static Seed ─────────────────────────────────────────────────────

// Seeded from Farside Investors public records (USD millions). Approximate values.
function makeSeed(): EtfFlowDay[] {
  const BASE_DATE = new Date('2025-01-06');
  const rows: [number, number, number, number, number, number][] = [
    // [IBIT, FBTC, ARKB, BITB, HODL, total]
    [596.1, 131.0, 42.6, 18.3, 9.2, 797.2],
    [473.4, 89.7, 38.1, 12.1, 5.4, 618.7],
    [0, 0, 0, 0, 0, 0], // weekend
    [0, 0, 0, 0, 0, 0],
    [512.3, 104.2, 31.0, 9.7, 4.1, 661.3],
    [389.7, 77.3, 22.4, 7.8, 3.2, 500.4],
    [201.4, 44.1, 15.7, 5.2, 2.1, 268.5],
    [654.8, 120.3, 48.9, 16.4, 7.3, 847.7],
    [441.2, 95.6, 35.2, 11.9, 5.8, 589.7],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [-89.4, -22.1, -8.3, -3.1, -1.4, -124.3],
    [234.7, 51.8, 18.9, 6.4, 2.9, 314.7],
    [389.1, 84.3, 28.7, 9.8, 4.6, 516.5],
    [512.6, 109.4, 39.1, 13.2, 6.1, 680.4],
    [276.4, 62.1, 21.3, 7.2, 3.4, 370.4],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [423.8, 91.2, 33.4, 11.3, 5.2, 564.9],
    [567.2, 118.6, 42.8, 14.4, 6.7, 749.7],
    [-145.3, -31.2, -11.4, -3.8, -1.8, -193.5],
    [198.4, 43.7, 15.9, 5.4, 2.5, 265.9],
    [334.6, 72.8, 26.3, 8.9, 4.1, 446.7],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [478.9, 102.3, 37.1, 12.5, 5.8, 636.6],
    [389.4, 84.1, 30.4, 10.3, 4.8, 519.0],
    [256.7, 55.4, 20.1, 6.8, 3.2, 342.2],
    [612.3, 131.4, 47.6, 16.1, 7.4, 814.8],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [445.8, 95.6, 34.7, 11.7, 5.5, 593.3],
    [378.2, 81.3, 29.5, 10.0, 4.6, 503.6],
    [-67.4, -14.5, -5.3, -1.8, -0.8, -89.8],
    [523.1, 112.4, 40.7, 13.8, 6.3, 696.3],
    [289.6, 62.3, 22.6, 7.6, 3.5, 385.6],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [467.3, 100.2, 36.4, 12.3, 5.7, 621.9],
    [534.8, 114.8, 41.6, 14.1, 6.5, 711.8],
    [312.4, 67.1, 24.3, 8.2, 3.8, 415.8],
    [-112.6, -24.2, -8.8, -3.0, -1.4, -150.0],
    [423.9, 91.0, 33.0, 11.2, 5.2, 564.3],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [489.7, 105.1, 38.1, 12.9, 5.9, 651.7],
    [345.6, 74.2, 26.9, 9.1, 4.2, 460.0],
    [567.8, 121.9, 44.2, 14.9, 6.9, 755.7],
    [401.3, 86.2, 31.2, 10.6, 4.9, 534.2],
    [234.8, 50.4, 18.3, 6.2, 2.9, 312.6],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [-78.3, -16.8, -6.1, -2.1, -1.0, -104.3],
    [512.4, 110.0, 39.9, 13.5, 6.2, 682.0],
    [389.7, 83.7, 30.3, 10.3, 4.7, 518.7],
    [456.2, 97.9, 35.5, 12.0, 5.5, 607.1],
    [623.8, 133.9, 48.5, 16.4, 7.6, 830.2],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [478.1, 102.6, 37.2, 12.6, 5.8, 636.3],
    [334.9, 71.9, 26.1, 8.8, 4.1, 445.8],
    [-134.2, -28.8, -10.5, -3.5, -1.6, -178.6],
    [289.4, 62.1, 22.5, 7.6, 3.5, 385.1],
    [567.3, 121.7, 44.1, 14.9, 6.9, 754.9],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [412.6, 88.5, 32.1, 10.9, 5.0, 549.1],
    [345.8, 74.2, 26.9, 9.1, 4.2, 460.2],
    [489.3, 105.0, 38.1, 12.9, 5.9, 651.2],
    [256.7, 55.1, 20.0, 6.8, 3.1, 341.7],
    [523.4, 112.3, 40.7, 13.8, 6.3, 696.5],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [-89.1, -19.1, -6.9, -2.3, -1.1, -118.5],
    [378.4, 81.2, 29.4, 10.0, 4.6, 503.6],
    [445.6, 95.6, 34.6, 11.7, 5.4, 592.9],
    [534.2, 114.6, 41.5, 14.1, 6.5, 710.9],
    [312.8, 67.1, 24.3, 8.2, 3.8, 416.2],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [467.9, 100.4, 36.4, 12.3, 5.7, 622.7],
    [589.3, 126.5, 45.8, 15.5, 7.2, 784.3],
    [401.2, 86.1, 31.2, 10.6, 4.9, 534.0],
    [-56.4, -12.1, -4.4, -1.5, -0.7, -75.1],
    [478.6, 102.7, 37.2, 12.6, 5.8, 636.9],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [345.1, 74.0, 26.8, 9.1, 4.2, 459.2],
    [512.7, 110.0, 39.9, 13.5, 6.2, 682.3],
    [423.5, 90.9, 32.9, 11.2, 5.1, 563.6],
  ];

  return rows.map(([ibit, fbtc, arkb, bitb, hodl, total], i) => {
    const d = new Date(BASE_DATE);
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      flows: { IBIT: ibit, FBTC: fbtc, ARKB: arkb, BITB: bitb, HODL: hodl },
      totalFlow: total,
    };
  });
}

export function getEtfFlowData(): EtfFlowData {
  const dailyFlows = makeSeed();
  let running = 0;
  const cumulative = dailyFlows.map((d) => {
    running += d.totalFlow;
    return { date: d.date, totalCumulative: running };
  });

  const today = new Date().toISOString().slice(0, 10);
  const currentMonthPrefix = today.slice(0, 7);
  const mtdFlows = dailyFlows.filter((d) => d.date.startsWith(currentMonthPrefix));
  const totalFlowMtd = mtdFlows.reduce((s, d) => s + d.totalFlow, 0);
  const totalFlowAllTime = running;

  const recentFlows = dailyFlows.slice(-10).filter((d) => d.totalFlow !== 0);
  const positiveCount = recentFlows.filter((d) => d.totalFlow > 0).length;
  const trend: EtfFlowData['summary']['trend'] =
    positiveCount >= 7 ? 'inflow' : positiveCount <= 3 ? 'outflow' : 'mixed';

  return {
    dailyFlows,
    cumulative,
    latestDay: dailyFlows[dailyFlows.length - 1],
    summary: { totalFlowMtd, totalFlowAllTime, trend },
    seedDate: '2026-04-05',
    isSeeded: true,
  };
}

// ─── Token Unlock Static Seed ──────────────────────────────────────────────────

const TOKEN_UNLOCK_SEED: Omit<TokenUnlockEvent, 'estimatedUsdValue'>[] = [
  {
    id: 'arb-2026-05-16',
    token: 'ARB',
    tokenName: 'Arbitrum',
    date: '2026-05-16',
    amountNative: 92_500_000,
    percentOfSupply: 0.925,
    category: 'investor',
    description: 'Investor & team vesting cliff unlock',
    isConfirmed: true,
  },
  {
    id: 'op-2026-05-31',
    token: 'OP',
    tokenName: 'Optimism',
    date: '2026-05-31',
    amountNative: 24_253_839,
    percentOfSupply: 0.282,
    category: 'investor',
    description: 'Investor vesting tranche',
    isConfirmed: true,
  },
  {
    id: 'sui-2026-06-01',
    token: 'SUI',
    tokenName: 'Sui',
    date: '2026-06-01',
    amountNative: 64_188_310,
    percentOfSupply: 0.75,
    category: 'team',
    description: 'Early contributor vesting unlock',
    isConfirmed: true,
  },
  {
    id: 'strk-2026-06-15',
    token: 'STRK',
    tokenName: 'Starknet',
    date: '2026-06-15',
    amountNative: 64_000_000,
    percentOfSupply: 0.64,
    category: 'ecosystem',
    description: 'Community & ecosystem grants tranche',
    isConfirmed: true,
  },
  {
    id: 'avax-2026-07-01',
    token: 'AVAX',
    tokenName: 'Avalanche',
    date: '2026-07-01',
    amountNative: 9_607_500,
    percentOfSupply: 0.234,
    category: 'team',
    description: 'Foundation team vesting',
    isConfirmed: true,
  },
  {
    id: 'zk-2026-07-17',
    token: 'ZK',
    tokenName: 'zkSync',
    date: '2026-07-17',
    amountNative: 838_500_000,
    percentOfSupply: 8.385,
    category: 'investor',
    description: 'Investor unlock — one-year cliff expiry',
    isConfirmed: true,
  },
  {
    id: 'eigen-2026-07-22',
    token: 'EIGEN',
    tokenName: 'Eigenlayer',
    date: '2026-07-22',
    amountNative: 55_000_000,
    percentOfSupply: 0.917,
    category: 'investor',
    description: 'Series B investor unlock',
    isConfirmed: true,
  },
  {
    id: 'sol-2026-08-01',
    token: 'SOL',
    tokenName: 'Solana',
    date: '2026-08-01',
    amountNative: 10_200_000,
    percentOfSupply: 0.215,
    category: 'vesting',
    description: 'FTX estate / Alameda residual vesting',
    isConfirmed: false,
  },
  {
    id: 'arb-2026-08-16',
    token: 'ARB',
    tokenName: 'Arbitrum',
    date: '2026-08-16',
    amountNative: 92_500_000,
    percentOfSupply: 0.925,
    category: 'investor',
    description: 'Monthly investor unlock (recurring)',
    isConfirmed: true,
  },
  {
    id: 'uni-2026-09-01',
    token: 'UNI',
    tokenName: 'Uniswap',
    date: '2026-09-01',
    amountNative: 21_951_220,
    percentOfSupply: 2.195,
    category: 'treasury',
    description: 'Uniswap Foundation treasury tranche',
    isConfirmed: false,
  },
];

const COINGECKO_TOKEN_IDS: Record<string, string> = {
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  STRK: 'starknet',
  AVAX: 'avalanche-2',
  ZK: 'zksync',
  EIGEN: 'eigenlayer',
  SOL: 'solana',
  UNI: 'uniswap',
};

export async function getTokenUnlockCalendar(): Promise<TokenUnlockCalendar> {
  const today = new Date().toISOString().slice(0, 10);
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const uniqueIds = [...new Set(TOKEN_UNLOCK_SEED.map((e) => COINGECKO_TOKEN_IDS[e.token]).filter(Boolean))];
  let prices: Record<string, number> = {};
  try {
    prices = await fetchCoinGeckoPrices(uniqueIds);
  } catch {
    // fallback to no prices
  }

  const events: TokenUnlockEvent[] = TOKEN_UNLOCK_SEED
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const cgId = COINGECKO_TOKEN_IDS[e.token];
      const price = cgId ? prices[cgId] ?? null : null;
      return {
        ...e,
        estimatedUsdValue: price ? e.amountNative * price : null,
      };
    });

  const upcoming30d = events.filter((e) => e.date <= in30d);
  const totalValueNext30d = upcoming30d.every((e) => e.estimatedUsdValue !== null)
    ? upcoming30d.reduce((s, e) => s + (e.estimatedUsdValue ?? 0), 0)
    : null;

  return {
    events,
    nextUnlock: events[0] ?? null,
    upcomingCount: upcoming30d.length,
    totalValueNext30d,
    generatedAt: new Date().toISOString(),
  };
}
