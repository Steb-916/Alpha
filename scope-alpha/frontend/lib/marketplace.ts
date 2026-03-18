// Marketplace types and mock data

export interface AnalystCard {
  id: string;
  slug: string;
  displayName: string;
  avatarInitial: string;
  subscriberCount: number;
  priceUsd: number; // monthly price in dollars
  winRate90d: number;
  totalPnl90d: number;
  activeSignals: number;
  avgRating: number;
  primaryAssets: string[];
  tradingStyle: string;
  sparkline: number[]; // 90-day cumulative P&L points
  joinedAt: string;
}

export type SortOption =
  | "subscribers"
  | "winRate"
  | "pnl"
  | "priceAsc"
  | "rating"
  | "newest";

export interface MarketplaceFilters {
  maxPrice: number;
  minWinRate: number;
  asset: string | null;
  minSubscribers: number;
  minRating: number;
}

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "subscribers", label: "Most Subscribers" },
  { value: "winRate", label: "Highest Win Rate" },
  { value: "pnl", label: "Best P&L (90d)" },
  { value: "priceAsc", label: "Lowest Price" },
  { value: "rating", label: "Highest Rated" },
  { value: "newest", label: "Newest" },
];

export const ASSET_FILTERS = ["BTC", "ETH", "SOL", "DOGE", "ARB", "AVAX"];

// Seeded PRNG for deterministic sparklines
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeSparkline(seed: number, trend: number): number[] {
  const rand = seeded(seed);
  const points: number[] = [0];
  for (let i = 1; i < 20; i++) {
    const delta = (rand() - 0.4) * 3 + trend * 0.3;
    points.push(Math.round((points[i - 1] + delta) * 100) / 100);
  }
  return points;
}

export const MOCK_ANALYSTS: AnalystCard[] = [
  {
    id: "a1",
    slug: "crypto-rex",
    displayName: "CryptoRex",
    avatarInitial: "C",
    subscriberCount: 342,
    priceUsd: 299,
    winRate90d: 70.6,
    totalPnl90d: 45.75,
    activeSignals: 3,
    avgRating: 4.7,
    primaryAssets: ["BTC", "ETH"],
    tradingStyle: "Swing",
    sparkline: makeSparkline(101, 1.2),
    joinedAt: "2025-06-15",
  },
  {
    id: "a2",
    slug: "sol-whale",
    displayName: "SolWhale",
    avatarInitial: "S",
    subscriberCount: 189,
    priceUsd: 149,
    winRate90d: 62.5,
    totalPnl90d: 28.4,
    activeSignals: 2,
    avgRating: 4.3,
    primaryAssets: ["SOL", "JTO"],
    tradingStyle: "Position",
    sparkline: makeSparkline(202, 0.8),
    joinedAt: "2025-09-20",
  },
  {
    id: "a3",
    slug: "degen-sensei",
    displayName: "DegenSensei",
    avatarInitial: "D",
    subscriberCount: 891,
    priceUsd: 499,
    winRate90d: 78.3,
    totalPnl90d: 92.1,
    activeSignals: 5,
    avgRating: 4.9,
    primaryAssets: ["BTC", "ETH", "SOL"],
    tradingStyle: "Scalp",
    sparkline: makeSparkline(303, 2.0),
    joinedAt: "2025-03-01",
  },
  {
    id: "a4",
    slug: "alpha-hunter",
    displayName: "AlphaHunter",
    avatarInitial: "A",
    subscriberCount: 567,
    priceUsd: 199,
    winRate90d: 65.2,
    totalPnl90d: 34.8,
    activeSignals: 4,
    avgRating: 4.5,
    primaryAssets: ["BTC", "DOGE"],
    tradingStyle: "Day Trade",
    sparkline: makeSparkline(404, 1.0),
    joinedAt: "2025-07-10",
  },
  {
    id: "a5",
    slug: "on-chain-oracle",
    displayName: "OnChainOracle",
    avatarInitial: "O",
    subscriberCount: 234,
    priceUsd: 399,
    winRate90d: 72.1,
    totalPnl90d: 56.3,
    activeSignals: 2,
    avgRating: 4.6,
    primaryAssets: ["ETH", "ARB", "AVAX"],
    tradingStyle: "Swing",
    sparkline: makeSparkline(505, 1.5),
    joinedAt: "2025-08-05",
  },
  {
    id: "a6",
    slug: "whale-watcher",
    displayName: "WhaleWatcher",
    avatarInitial: "W",
    subscriberCount: 156,
    priceUsd: 99,
    winRate90d: 58.8,
    totalPnl90d: 12.6,
    activeSignals: 1,
    avgRating: 4.1,
    primaryAssets: ["BTC"],
    tradingStyle: "Position",
    sparkline: makeSparkline(606, 0.4),
    joinedAt: "2025-11-01",
  },
  {
    id: "a7",
    slug: "perp-king",
    displayName: "PerpKing",
    avatarInitial: "P",
    subscriberCount: 723,
    priceUsd: 699,
    winRate90d: 81.4,
    totalPnl90d: 118.7,
    activeSignals: 6,
    avgRating: 4.8,
    primaryAssets: ["BTC", "ETH", "SOL"],
    tradingStyle: "Scalp",
    sparkline: makeSparkline(707, 2.5),
    joinedAt: "2025-04-15",
  },
  {
    id: "a8",
    slug: "macro-mike",
    displayName: "MacroMike",
    avatarInitial: "M",
    subscriberCount: 412,
    priceUsd: 349,
    winRate90d: 67.9,
    totalPnl90d: 41.2,
    activeSignals: 3,
    avgRating: 4.4,
    primaryAssets: ["BTC", "ETH"],
    tradingStyle: "Swing",
    sparkline: makeSparkline(808, 1.1),
    joinedAt: "2025-05-20",
  },
];

export function filterAndSortAnalysts(
  analysts: AnalystCard[],
  filters: MarketplaceFilters,
  sort: SortOption
): AnalystCard[] {
  let filtered = analysts.filter((a) => {
    if (a.priceUsd > filters.maxPrice) return false;
    if (a.winRate90d < filters.minWinRate) return false;
    if (filters.asset && !a.primaryAssets.includes(filters.asset)) return false;
    if (a.subscriberCount < filters.minSubscribers) return false;
    if (a.avgRating < filters.minRating) return false;
    return true;
  });

  switch (sort) {
    case "subscribers":
      filtered.sort((a, b) => b.subscriberCount - a.subscriberCount);
      break;
    case "winRate":
      filtered.sort((a, b) => b.winRate90d - a.winRate90d);
      break;
    case "pnl":
      filtered.sort((a, b) => b.totalPnl90d - a.totalPnl90d);
      break;
    case "priceAsc":
      filtered.sort((a, b) => a.priceUsd - b.priceUsd);
      break;
    case "rating":
      filtered.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case "newest":
      filtered.sort(
        (a, b) =>
          new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
      );
      break;
  }

  return filtered;
}
