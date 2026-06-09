import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBacktest } from "@/lib/analytics/backtest-engine";
import type { DaySnapshot, BacktestConfig } from "@/lib/analytics/backtest-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

interface BacktestRequest {
  asset: string;
  from: string;   // ISO date "YYYY-MM-DD"
  to: string;     // ISO date "YYYY-MM-DD"
  direction: "long" | "short";
  entry: { field: string; operator: string; value: number }[];
  exit: { field: string; operator: string; value: number }[];
  stopLossPct?: number;
  takeProfitPct?: number;
  initialCapital?: number;
}

export async function POST(req: Request) {
  let body: BacktestRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { asset, from, to, direction = "long", entry, exit, stopLossPct, takeProfitPct, initialCapital = 10000 } = body;

  if (!asset || !from || !to) {
    return NextResponse.json({ error: "asset, from, to required" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  // Fetch all data in parallel
  const [candles, fundingRows, healthRows, onchainRows, ivRows] = await Promise.all([
    prisma.candleHistory.findMany({
      where: { asset, timeframe: "1d", timestamp: { gte: fromDate, lte: toDate } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
    }),
    prisma.fundingRateSnapshot.findMany({
      where: { asset, timestamp: { gte: fromDate, lte: toDate } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, rate: true },
    }),
    prisma.healthScoreSnapshot.findMany({
      where: { asset, timestamp: { gte: fromDate, lte: toDate } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, score: true },
    }),
    prisma.onChainSnapshot.findMany({
      where: { asset, timestamp: { gte: fromDate, lte: toDate } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, mvrvZScore: true, sopr: true, nvtRatio: true },
    }),
    prisma.iVSnapshot.findMany({
      where: { asset, timestamp: { gte: fromDate, lte: toDate } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, iv30d: true },
    }),
  ]);

  if (candles.length === 0) {
    return NextResponse.json(
      { error: `No price data found for ${asset} in range ${from}–${to}. Make sure the cron has been running.` },
      { status: 404 },
    );
  }

  // Build daily-bucketed maps (average per day)
  function dayKey(ts: Date): string {
    return ts.toISOString().slice(0, 10);
  }

  function buildDailyAvg<T extends { timestamp: Date }>(
    rows: T[],
    getValue: (r: T) => number | null | undefined,
  ): Map<string, number> {
    const acc = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const key = dayKey(row.timestamp);
      const v = getValue(row);
      if (v == null || isNaN(v)) continue;
      const existing = acc.get(key) ?? { sum: 0, count: 0 };
      acc.set(key, { sum: existing.sum + v, count: existing.count + 1 });
    }
    const result = new Map<string, number>();
    for (const [key, { sum, count }] of acc.entries()) {
      result.set(key, sum / count);
    }
    return result;
  }

  const fundingByDay = buildDailyAvg(fundingRows, (r) => r.rate);
  const healthByDay = buildDailyAvg(healthRows, (r) => r.score);
  const mvrvByDay = buildDailyAvg(onchainRows, (r) => r.mvrvZScore);
  const soprByDay = buildDailyAvg(onchainRows, (r) => r.sopr);
  const ivByDay = buildDailyAvg(ivRows, (r) => r.iv30d);

  // Build OI change map from funding snapshots (we use OISnapshot instead if available)
  // For now: oiChangeDay is omitted — no daily OI snapshots easily available

  // Assemble DaySnapshot[]
  const snapshots: DaySnapshot[] = [];
  let prevClose: number | null = null;

  for (const candle of candles) {
    const key = dayKey(candle.timestamp);
    const priceChange1d = prevClose != null ? ((candle.close - prevClose) / prevClose) * 100 : 0;

    snapshots.push({
      date: key,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      priceChange1d,
      fundingRate: fundingByDay.get(key),
      healthScore: healthByDay.get(key),
      mvrvZScore: mvrvByDay.get(key),
      sopr: soprByDay.get(key),
      iv30d: ivByDay.get(key),
    });
    prevClose = candle.close;
  }

  const config: BacktestConfig = {
    asset,
    direction,
    entry: entry ?? [],
    exit: exit ?? [],
    stopLossPct,
    takeProfitPct,
    initialCapital,
  };

  const result = runBacktest(snapshots, config);

  return NextResponse.json({
    ...result,
    meta: {
      asset,
      from,
      to,
      direction,
      daysOfData: snapshots.length,
    },
  });
}
