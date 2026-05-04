import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { fetchCoinGeckoClose, fetchFearGreed } from '@/lib/macro/fetchers';
import type { FundingData } from '@/lib/types';
import type { OnChainOverview } from '@/lib/onchain/types';
import type { MacroRegimeLabel, MacroRegimeResult, RegimeFactor } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 900; // 15 min
const ALLOWED = new Set(['BTC', 'ETH']);

function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function scoreToSignal(score: number): RegimeFactor['signal'] {
  if (score >= 65) return 'bullish';
  if (score <= 35) return 'bearish';
  return 'neutral';
}

function btcTrendFactor(prices: number[]): RegimeFactor {
  const current = prices[prices.length - 1] ?? 0;
  const sma50 = sma(prices, 50);
  const sma200 = sma(prices, 200);

  let value = current;
  let score = 50;
  let description = 'Price near SMA50';

  if (sma50 && sma200) {
    if (current > sma50 && current > sma200) {
      score = 78;
      description = `Price above SMA50 & SMA200 (${sma50.toFixed(0)} / ${sma200.toFixed(0)})`;
    } else if (current > sma200 && current <= sma50) {
      score = 52;
      description = `Price below SMA50 but above SMA200`;
    } else if (current <= sma200) {
      score = 24;
      description = `Price below SMA200 (${sma200.toFixed(0)})`;
    }
  } else if (sma50) {
    score = current > sma50 ? 65 : 38;
    description = current > sma50 ? `Above SMA50 (${sma50.toFixed(0)})` : `Below SMA50 (${sma50.toFixed(0)})`;
  }

  return {
    name: 'BTC Trend',
    value,
    signal: scoreToSignal(score),
    weight: 0.35,
    description,
  };
}

function fundingFactor(funding: FundingData | null): RegimeFactor {
  if (!funding) {
    return { name: 'Funding Rate', value: 0, signal: 'neutral', weight: 0.25, description: 'Funding data unavailable' };
  }
  const z = funding.zScore ?? 0;
  let score = 50;
  let description = `Funding z-score: ${z.toFixed(2)}`;

  if (z < -1) {
    score = 78;
    description = `Funding z=${z.toFixed(2)} — negative funding, potential accumulation signal`;
  } else if (z > 2) {
    score = 22;
    description = `Funding z=${z.toFixed(2)} — overheated longs, risk of deleveraging`;
  } else if (z > 1) {
    score = 38;
    description = `Funding z=${z.toFixed(2)} — elevated funding, caution`;
  } else {
    score = 55;
    description = `Funding z=${z.toFixed(2)} — neutral funding environment`;
  }

  return { name: 'Funding Rate', value: z, signal: scoreToSignal(score), weight: 0.25, description };
}

function mvrvFactor(onchain: OnChainOverview | null): RegimeFactor {
  if (!onchain || onchain.mvrvZScore == null) {
    return { name: 'MVRV Z-Score', value: 0, signal: 'neutral', weight: 0.25, description: 'On-chain data unavailable' };
  }
  const z = onchain.mvrvZScore;
  let score = 50;
  let description = `MVRV z=${z.toFixed(2)}`;

  if (z < 0) {
    score = 80;
    description = `MVRV z=${z.toFixed(2)} — historically undervalued, accumulation zone`;
  } else if (z < 1) {
    score = 65;
    description = `MVRV z=${z.toFixed(2)} — fair value territory`;
  } else if (z < 3) {
    score = 45;
    description = `MVRV z=${z.toFixed(2)} — approaching fair value ceiling`;
  } else {
    score = 20;
    description = `MVRV z=${z.toFixed(2)} — historically overvalued, elevated cycle risk`;
  }

  return { name: 'MVRV Z-Score', value: z, signal: scoreToSignal(score), weight: 0.25, description };
}

function fearGreedFactor(fgValue: number): RegimeFactor {
  let score = 50;
  let description = `Fear & Greed: ${fgValue}`;

  // Contrarian: extreme fear = bullish signal, extreme greed = bearish
  if (fgValue <= 20) {
    score = 80;
    description = `Extreme Fear (${fgValue}) — contrarian buy zone`;
  } else if (fgValue <= 40) {
    score = 65;
    description = `Fear (${fgValue}) — risk appetite depressed`;
  } else if (fgValue >= 80) {
    score = 20;
    description = `Extreme Greed (${fgValue}) — contrarian caution zone`;
  } else if (fgValue >= 60) {
    score = 38;
    description = `Greed (${fgValue}) — elevated risk sentiment`;
  } else {
    score = 50;
    description = `Neutral (${fgValue}) — balanced sentiment`;
  }

  return { name: 'Fear & Greed', value: fgValue, signal: scoreToSignal(score), weight: 0.15, description };
}

function computeRegime(
  btcTrend: RegimeFactor,
  fundingRate: RegimeFactor,
  mvrv: RegimeFactor,
  fearGreed: RegimeFactor,
  fgHistory: { date: string; value: number }[],
): MacroRegimeResult {
  const factors = { btcTrend, fundingRate, mvrv, fearGreed };

  // Factor scores via back-calculation from description
  const factorScores: Record<string, number> = {};
  for (const [k, f] of Object.entries(factors)) {
    if (f.signal === 'bullish') factorScores[k] = 75;
    else if (f.signal === 'bearish') factorScores[k] = 25;
    else factorScores[k] = 50;
  }

  const weights = { btcTrend: 0.35, fundingRate: 0.25, mvrv: 0.25, fearGreed: 0.15 };
  let composite = 0;
  for (const [k, w] of Object.entries(weights)) {
    composite += (factorScores[k] ?? 50) * w;
  }

  let regime: MacroRegimeLabel = 'Neutral';
  if (composite >= 65) {
    regime = 'Bull';
  } else if (composite <= 35) {
    regime = 'Bear';
  } else if (mvrv.signal === 'bullish' && composite >= 50) {
    regime = 'Accumulation';
  }

  const confidence = Math.min(100, Math.max(0, Math.round(Math.abs(composite - 50) * 2)));

  // Build 90-day history using Fear & Greed as a proxy for regime signal
  const history = fgHistory.slice(-90).map((fg) => {
    const fgScore = fg.value <= 25 ? 75 : fg.value >= 75 ? 25 : 50;
    const approxScore = fgScore * 0.5 + composite * 0.5; // blend with current composite
    let r: MacroRegimeLabel = 'Neutral';
    if (approxScore >= 65) r = 'Bull';
    else if (approxScore <= 35) r = 'Bear';
    else if (approxScore >= 50) r = 'Accumulation';
    return { timestamp: fg.date, regime: r, score: Math.round(approxScore) };
  });

  return {
    regime,
    confidence,
    score: Math.round(composite),
    factors,
    history,
    computedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'Regime available for BTC and ETH only' }, { status: 400 });
  }

  const key = `macro:regime:${asset}`;
  const fresh = await getCached<MacroRegimeResult>(key);
  if (fresh) return NextResponse.json(fresh);

  try {
    const [prices, funding, onchain, fgHistory] = await Promise.all([
      fetchCoinGeckoClose(asset as 'BTC' | 'ETH', 210).then((pts) => pts.map((p) => p.close)),
      getCached<FundingData>(`market:funding:${asset}`),
      getCached<OnChainOverview>(`onchain:overview:${asset}`),
      fetchFearGreed(90),
    ]);

    const currentFg = fgHistory[0]?.value ?? 50;
    const result = computeRegime(
      btcTrendFactor(prices),
      fundingFactor(funding),
      mvrvFactor(onchain),
      fearGreedFactor(currentFg),
      fgHistory,
    );

    await Promise.all([setCached(key, result, TTL), setStale(key, result)]);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[macro/regime] compute failed:', err);
    const stale = await getStale<MacroRegimeResult>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Regime data unavailable' }, { status: 503 });
  }
}
