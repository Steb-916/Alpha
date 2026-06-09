import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export interface SimilarityMatch {
  date: string;
  close: number;
  distance: number;
  similarityPct: number;
  healthScore: number | null;
  fundingRate: number | null;
  priceChange1d: number | null;
  mvrvZScore: number | null;
  sopr: number | null;
  iv30d: number | null;
  fwd7d: number | null;
  fwd14d: number | null;
  fwd30d: number | null;
}

export interface SimilarityResponse {
  matches: SimilarityMatch[];
  queryVector: Record<string, number | null>;
  asset: string;
}

export async function POST(req: Request) {
  let body: { asset: string; topN?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { asset = "BTC", topN = 10 } = body;
  const upperAsset = asset.toUpperCase();

  const QUANT_URL = process.env.QUANT_ENGINE_URL;
  const QUANT_KEY = process.env.QUANT_ENGINE_API_KEY;
  if (!QUANT_URL) {
    return NextResponse.json({ error: "Quant engine not configured" }, { status: 503 });
  }

  // Fetch last 365 days of history from DB in parallel
  const cutoff365 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const cutoffAll = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);

  const [recentCandles, allCandles, healthSnaps, onChainSnaps, ivSnaps, fundingSnaps] =
    await Promise.all([
      // Last 7 days to get current state
      prisma.candleHistory.findMany({
        where: { asset: upperAsset, timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        orderBy: { timestamp: "desc" },
        take: 7,
      }),
      // All history for similarity search
      prisma.candleHistory.findMany({
        where: { asset: upperAsset, timestamp: { gte: cutoffAll } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, close: true, volume: true },
      }),
      prisma.healthScoreSnapshot.findMany({
        where: { asset: upperAsset, timestamp: { gte: cutoffAll } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, score: true },
      }),
      prisma.onChainSnapshot.findMany({
        where: { asset: upperAsset, timestamp: { gte: cutoffAll } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, mvrvZScore: true, sopr: true },
      }),
      prisma.iVSnapshot.findMany({
        where: { asset: upperAsset, timestamp: { gte: cutoffAll } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, iv30d: true },
      }),
      prisma.fundingRateSnapshot.findMany({
        where: { asset: upperAsset, timestamp: { gte: cutoffAll } },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, rate: true },
      }),
    ]);

  if (!recentCandles.length || !allCandles.length) {
    return NextResponse.json({ error: "No price data found" }, { status: 404 });
  }

  // Build daily maps
  function toDateKey(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  const healthMap = new Map<string, number>();
  for (const h of healthSnaps) healthMap.set(toDateKey(h.timestamp), h.score);

  const onChainMap = new Map<string, { mvrv: number | null; sopr: number | null }>();
  for (const o of onChainSnaps) {
    onChainMap.set(toDateKey(o.timestamp), {
      mvrv: o.mvrvZScore ?? null,
      sopr: (o as any).sopr ?? null,
    });
  }

  const ivMap = new Map<string, number>();
  for (const iv of ivSnaps) if (iv.iv30d != null) ivMap.set(toDateKey(iv.timestamp), iv.iv30d);

  const fundingMap = new Map<string, number>();
  for (const f of fundingSnaps) fundingMap.set(toDateKey(f.timestamp), f.rate);

  // Build per-day close array for priceChange1d
  const closePrices: { date: string; close: number }[] = allCandles.map((c) => ({
    date: toDateKey(c.timestamp),
    close: c.close,
  }));

  // Build forward returns map: fwd7d, fwd14d, fwd30d
  const closeByDate = new Map<string, number>();
  for (const c of closePrices) closeByDate.set(c.date, c.close);

  function fwdReturn(date: string, days: number): number | null {
    const base = closeByDate.get(date);
    if (!base) return null;
    const target = new Date(date);
    target.setDate(target.getDate() + days);
    const targetDate = toDateKey(target);
    const fwdClose = closeByDate.get(targetDate);
    if (!fwdClose) return null;
    return ((fwdClose - base) / base) * 100;
  }

  // Assemble history snapshots
  const history = closePrices.map((c, i) => {
    const prevClose = i > 0 ? closePrices[i - 1].close : null;
    const priceChange1d = prevClose ? ((c.close - prevClose) / prevClose) * 100 : null;
    const oc = onChainMap.get(c.date);
    return {
      date: c.date,
      close: c.close,
      healthScore: healthMap.get(c.date) ?? null,
      fundingRate: fundingMap.get(c.date) ?? null,
      priceChange1d,
      mvrvZScore: oc?.mvrv ?? null,
      sopr: oc?.sopr ?? null,
      iv30d: ivMap.get(c.date) ?? null,
      fwd7d: fwdReturn(c.date, 7),
      fwd14d: fwdReturn(c.date, 14),
      fwd30d: fwdReturn(c.date, 30),
    };
  });

  // Build current state from most recent candle
  const latestCandle = recentCandles[0];
  const latestDate = toDateKey(latestCandle.timestamp);
  const prevCandle = recentCandles[1];
  const prevClose = prevCandle?.close ?? null;
  const currentPriceChange = prevClose ? ((latestCandle.close - prevClose) / prevClose) * 100 : null;
  const currentOC = onChainMap.get(latestDate);

  const current = {
    healthScore: healthMap.get(latestDate) ?? null,
    fundingRate: fundingMap.get(latestDate) ?? null,
    priceChange1d: currentPriceChange,
    mvrvZScore: currentOC?.mvrv ?? null,
    sopr: currentOC?.sopr ?? null,
    iv30d: ivMap.get(latestDate) ?? null,
  };

  // Call quant engine
  const quantRes = await fetch(`${QUANT_URL}/similarity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Quant-Key": QUANT_KEY ?? "",
    },
    body: JSON.stringify({ current, history, top_n: topN }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!quantRes.ok) {
    const txt = await quantRes.text().catch(() => "");
    return NextResponse.json({ error: `Quant engine error: ${txt}` }, { status: 502 });
  }

  const quantData = await quantRes.json();

  return NextResponse.json({
    matches: quantData.matches,
    queryVector: quantData.query_vector,
    asset: upperAsset,
  } satisfies SimilarityResponse);
}
