// Performance calculation utilities
// Calculates analyst metrics from resolved signals

import type { Signal } from "./signals";

export interface PerformanceMetrics {
  totalSignals: number;
  winCount: number;
  lossCount: number;
  winRate: number | null;
  avgPnlPercent: number | null;
  profitFactor: number | null;
  avgRrRatio: number | null;
  bestStreak: number;
  worstStreak: number;
  totalPnlPercent: number | null;
  activeSignals: number;
  monthlyReturns: { month: string; pnl: number }[];
  cumulativePnl: { date: string; pnl: number }[];
}

export function calculatePerformance(signals: Signal[]): PerformanceMetrics {
  const resolved = signals.filter(
    (s) => s.status === "target_hit" || s.status === "stopped_out"
  );
  const active = signals.filter((s) => s.status === "active");
  const wins = resolved.filter((s) => s.status === "target_hit");
  const losses = resolved.filter((s) => s.status === "stopped_out");

  const winRate =
    resolved.length > 0 ? (wins.length / resolved.length) * 100 : null;

  // Average P&L
  const pnls = resolved
    .map((s) => s.resultPnlPercent)
    .filter((p): p is number => p !== null);
  const avgPnlPercent =
    pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : null;

  // Profit factor: gross profits / gross losses
  const grossProfit = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(
    pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0)
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  // Average R:R on winning trades
  const rrRatios = wins
    .map((s) => {
      const reward = Math.abs(s.targetPrice - s.entryPrice);
      const risk = Math.abs(s.entryPrice - s.stopLossPrice);
      return risk > 0 ? reward / risk : null;
    })
    .filter((r): r is number => r !== null);
  const avgRrRatio =
    rrRatios.length > 0
      ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length
      : null;

  // Streaks
  let bestStreak = 0;
  let worstStreak = 0;
  let currentWin = 0;
  let currentLoss = 0;
  const sortedResolved = [...resolved].sort(
    (a, b) =>
      new Date(a.resolvedAt || a.publishedAt).getTime() -
      new Date(b.resolvedAt || b.publishedAt).getTime()
  );
  for (const s of sortedResolved) {
    if (s.status === "target_hit") {
      currentWin++;
      currentLoss = 0;
      bestStreak = Math.max(bestStreak, currentWin);
    } else {
      currentLoss++;
      currentWin = 0;
      worstStreak = Math.max(worstStreak, currentLoss);
    }
  }

  // Total P&L
  const totalPnlPercent =
    pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) : null;

  // Monthly returns
  const monthlyMap = new Map<string, number>();
  for (const s of sortedResolved) {
    if (s.resultPnlPercent === null) continue;
    const date = new Date(s.resolvedAt || s.publishedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + s.resultPnlPercent);
  }
  const monthlyReturns = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 }));

  // Cumulative P&L curve
  let cumPnl = 0;
  const cumulativePnl = sortedResolved
    .filter((s) => s.resultPnlPercent !== null)
    .map((s) => {
      cumPnl += s.resultPnlPercent!;
      return {
        date: (s.resolvedAt || s.publishedAt).split("T")[0],
        pnl: Math.round(cumPnl * 100) / 100,
      };
    });

  return {
    totalSignals: signals.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: winRate !== null ? Math.round(winRate * 100) / 100 : null,
    avgPnlPercent:
      avgPnlPercent !== null ? Math.round(avgPnlPercent * 100) / 100 : null,
    profitFactor:
      profitFactor !== null ? Math.round(profitFactor * 100) / 100 : null,
    avgRrRatio:
      avgRrRatio !== null ? Math.round(avgRrRatio * 100) / 100 : null,
    bestStreak,
    worstStreak,
    totalPnlPercent:
      totalPnlPercent !== null
        ? Math.round(totalPnlPercent * 100) / 100
        : null,
    activeSignals: active.length,
    monthlyReturns,
    cumulativePnl,
  };
}

// Simple seeded PRNG for deterministic mock data (avoids hydration mismatch)
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Generate mock signals for demo profiles
export function generateMockSignals(analystId: string): Signal[] {
  // Create a deterministic seed from the analystId string
  let seed = 0;
  for (let i = 0; i < analystId.length; i++) {
    seed = ((seed << 5) - seed + analystId.charCodeAt(i)) | 0;
  }
  const rand = seededRandom(Math.abs(seed) || 1);

  const assets = ["BTC", "ETH", "SOL", "DOGE"];
  const statuses: ("target_hit" | "stopped_out" | "active")[] = [
    "target_hit",
    "target_hit",
    "target_hit",
    "stopped_out",
    "target_hit",
    "stopped_out",
    "target_hit",
    "active",
    "active",
    "target_hit",
    "stopped_out",
    "target_hit",
    "target_hit",
    "target_hit",
    "stopped_out",
    "target_hit",
    "active",
    "target_hit",
    "stopped_out",
    "target_hit",
  ];

  // Use a fixed reference date for deterministic timestamps
  const refDate = new Date("2026-03-15T12:00:00Z").getTime();
  return statuses.map((status, i) => {
    const asset = assets[i % assets.length];
    const isLong = rand() > 0.35;
    const basePrice = asset === "BTC" ? 67000 : asset === "ETH" ? 3400 : asset === "SOL" ? 145 : 0.16;
    const entry = basePrice * (0.95 + rand() * 0.1);
    const target = isLong ? entry * (1.02 + rand() * 0.08) : entry * (0.92 + rand() * 0.06);
    const stop = isLong ? entry * (0.97 - rand() * 0.02) : entry * (1.02 + rand() * 0.03);

    let pnl: number | null = null;
    let resolvedPrice: number | null = null;
    if (status === "target_hit") {
      resolvedPrice = target;
      pnl = isLong
        ? ((target - entry) / entry) * 100
        : ((entry - target) / entry) * 100;
    } else if (status === "stopped_out") {
      resolvedPrice = stop;
      pnl = isLong
        ? ((stop - entry) / entry) * 100
        : ((entry - stop) / entry) * 100;
    }

    const daysAgo = (statuses.length - i) * 3 + Math.floor(rand() * 3);
    const publishedAt = new Date(refDate - daysAgo * 86400000);
    const resolvedAt = status !== "active" ? new Date(refDate - (daysAgo - 1) * 86400000) : null;

    return {
      id: `mock-sig-${analystId}-${i}`,
      analystId,
      assetSymbol: asset,
      direction: isLong ? "long" : "short",
      entryPrice: Math.round(entry * 100) / 100,
      targetPrice: Math.round(target * 100) / 100,
      stopLossPrice: Math.round(stop * 100) / 100,
      timeframe: ["4H", "1D", "1W"][i % 3],
      conviction: (["medium", "high", "low"] as const)[i % 3],
      notes: i % 3 === 0 ? "Key support level bounce expected" : null,
      status,
      publishedAt: publishedAt.toISOString(),
      resolvedAt: resolvedAt?.toISOString() || null,
      resolvedPrice: resolvedPrice ? Math.round(resolvedPrice * 100) / 100 : null,
      resultPnlPercent: pnl ? Math.round(pnl * 100) / 100 : null,
      createdAt: publishedAt.toISOString(),
    } as Signal;
  });
}
