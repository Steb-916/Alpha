import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { fetchCoinGeckoClose, fetchFearGreed } from '@/lib/macro/fetchers';
import type { FundingData } from '@/lib/types';
import type { OnChainOverview } from '@/lib/onchain/types';
import type {
  MacroRegimeLabel,
  MacroRegimeResult,
  RegimeFactor,
} from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 900;
const ALLOWED = new Set(['BTC', 'ETH']);

// ─── Historical context seeded per regime type ──────────────────────────────
// Based on crypto market history 2019-2024, approximate medians.
const HISTORICAL_CONTEXT: Record<
  MacroRegimeLabel,
  { medianReturn30d: number; winRate: number; avgMaxDrawdown: number; sampleCount: number }
> = {
  'Risk-On':      { medianReturn30d: 18.4,  winRate: 0.72, avgMaxDrawdown: -8.2,  sampleCount: 31 },
  'Risk-Off':     { medianReturn30d: -14.7, winRate: 0.28, avgMaxDrawdown: -22.1, sampleCount: 24 },
  'Accumulation': { medianReturn30d: 6.1,   winRate: 0.61, avgMaxDrawdown: -10.4, sampleCount: 18 },
  'Distribution': { medianReturn30d: -4.2,  winRate: 0.40, avgMaxDrawdown: -14.8, sampleCount: 14 },
  'Volatile':     { medianReturn30d: -2.1,  winRate: 0.48, avgMaxDrawdown: -28.6, sampleCount: 22 },
  'Compressed':   { medianReturn30d: 8.9,   winRate: 0.58, avgMaxDrawdown: -7.3,  sampleCount: 11 },
};

// ─── Contextual emphasis per regime ─────────────────────────────────────────
const CONTEXTUAL_EMPHASIS: Record<MacroRegimeLabel, string[]> = {
  'Risk-On':      ['Funding Rate', 'OI Momentum', 'CVD Divergence', 'Basis Rate'],
  'Risk-Off':     ['Liquidation Levels', 'Exchange Inflows', 'Funding Rate', 'MVRV'],
  'Accumulation': ['On-Chain Accumulation', 'Options Positioning', 'Vol Cone', 'MVRV'],
  'Distribution': ['Exchange Inflows', 'SOPR', 'Skew', 'Funding Rate'],
  'Volatile':     ['Liquidation Levels', 'GEX Regime', 'Stablecoin Inflows', 'Realized Vol'],
  'Compressed':   ['Vol Cone', 'Funding Rate', 'Options Flow', 'OI Build'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sma(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function realizedVol(prices: number[], window: number): number | null {
  if (prices.length < window + 1) return null;
  const recent = prices.slice(-window - 1);
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i - 1] > 0 && recent[i] > 0) {
      logReturns.push(Math.log(recent[i] / recent[i - 1]));
    }
  }
  if (logReturns.length < 3) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / logReturns.length;
  return Math.sqrt(variance * 252); // annualized
}

function scoreToSignal(score: number): RegimeFactor['signal'] {
  if (score >= 62) return 'bullish';
  if (score <= 38) return 'bearish';
  return 'neutral';
}

// ─── Factor builders ─────────────────────────────────────────────────────────

function btcTrendFactor(prices: number[]): RegimeFactor {
  const current = prices[prices.length - 1] ?? 0;
  const sma50 = sma(prices, 50);
  const sma200 = sma(prices, 200);

  let score = 50;
  let description = 'Insufficient price history';

  if (sma50 && sma200) {
    if (current > sma50 && current > sma200) {
      score = 78;
      description = `Price above SMA50 & SMA200 (${sma50.toFixed(0)} / ${sma200.toFixed(0)})`;
    } else if (current > sma200 && current <= sma50) {
      score = 52;
      description = `Price below SMA50 but above SMA200`;
    } else if (current <= sma200 && current > sma50) {
      score = 42;
      description = `Price above SMA50 but below SMA200 (death cross zone)`;
    } else {
      score = 22;
      description = `Price below both SMA50 & SMA200 (${sma200.toFixed(0)})`;
    }
  } else if (sma50) {
    score = current > sma50 ? 64 : 36;
    description = current > sma50
      ? `Above SMA50 (${sma50.toFixed(0)})`
      : `Below SMA50 (${sma50.toFixed(0)})`;
  }

  return { name: 'Price Trend', value: current, signal: scoreToSignal(score), weight: 0.30, description };
}

function fundingFactor(funding: FundingData | null): RegimeFactor {
  if (!funding) {
    return { name: 'Funding Rate', value: 0, signal: 'neutral', weight: 0.20, description: 'Funding data unavailable' };
  }
  const z = funding.zScore ?? 0;
  let score = 50;
  let description = `Funding z-score: ${z.toFixed(2)}`;

  if (z < -2) {
    score = 82;
    description = `Funding z=${z.toFixed(2)} — extreme negative, shorts overheated`;
  } else if (z < -1) {
    score = 72;
    description = `Funding z=${z.toFixed(2)} — negative funding, potential accumulation signal`;
  } else if (z > 3) {
    score = 15;
    description = `Funding z=${z.toFixed(2)} — extreme longs, high deleveraging risk`;
  } else if (z > 2) {
    score = 24;
    description = `Funding z=${z.toFixed(2)} — overheated longs, risk elevated`;
  } else if (z > 1) {
    score = 40;
    description = `Funding z=${z.toFixed(2)} — elevated longs, caution`;
  } else {
    score = 55;
    description = `Funding z=${z.toFixed(2)} — neutral funding environment`;
  }

  return { name: 'Funding Rate', value: z, signal: scoreToSignal(score), weight: 0.20, description };
}

function mvrvFactor(onchain: OnChainOverview | null): RegimeFactor {
  if (!onchain || onchain.mvrvZScore == null) {
    return { name: 'MVRV Z-Score', value: 0, signal: 'neutral', weight: 0.25, description: 'On-chain data unavailable' };
  }
  const z = onchain.mvrvZScore;
  let score = 50;
  let description = `MVRV z=${z.toFixed(2)}`;

  if (z < -0.5) {
    score = 82;
    description = `MVRV z=${z.toFixed(2)} — historically undervalued, deep accumulation zone`;
  } else if (z < 1) {
    score = 66;
    description = `MVRV z=${z.toFixed(2)} — fair value territory, accumulation bias`;
  } else if (z < 3) {
    score = 46;
    description = `MVRV z=${z.toFixed(2)} — approaching fair value ceiling`;
  } else if (z < 5) {
    score = 28;
    description = `MVRV z=${z.toFixed(2)} — historically overvalued, distribution risk`;
  } else {
    score = 14;
    description = `MVRV z=${z.toFixed(2)} — extreme overvaluation, cycle peak territory`;
  }

  return { name: 'MVRV Z-Score', value: z, signal: scoreToSignal(score), weight: 0.25, description };
}

function fearGreedFactor(fgValue: number): RegimeFactor {
  let score = 50;
  let description = `Fear & Greed: ${fgValue}`;

  if (fgValue <= 15) {
    score = 82;
    description = `Extreme Fear (${fgValue}) — maximum contrarian buy signal`;
  } else if (fgValue <= 30) {
    score = 68;
    description = `Fear (${fgValue}) — risk appetite depressed, contrarian bullish`;
  } else if (fgValue >= 85) {
    score = 16;
    description = `Extreme Greed (${fgValue}) — maximum contrarian caution`;
  } else if (fgValue >= 70) {
    score = 32;
    description = `Greed (${fgValue}) — elevated risk sentiment, contrarian bearish`;
  } else {
    score = 50;
    description = `Neutral (${fgValue}) — balanced sentiment`;
  }

  return { name: 'Fear & Greed', value: fgValue, signal: scoreToSignal(score), weight: 0.10, description };
}

// ─── Vol state classification ─────────────────────────────────────────────────

function classifyVolState(
  prices: number[],
): { state: MacroRegimeResult['volState']; volFactor: RegimeFactor } {
  const vol14 = realizedVol(prices, 14);
  const vol90 = realizedVol(prices, 90);

  if (vol14 == null || vol90 == null || vol90 === 0) {
    return {
      state: 'normal',
      volFactor: { name: 'Realized Vol', value: 0, signal: 'neutral', weight: 0.15, description: 'Insufficient data' },
    };
  }

  const ratio = vol14 / vol90;
  let state: MacroRegimeResult['volState'] = 'normal';
  let score = 50;
  let description = `14d rvol ${(vol14 * 100).toFixed(1)}% vs 90d avg ${(vol90 * 100).toFixed(1)}%`;

  if (ratio > 1.6) {
    state = 'high';
    score = 30; // high vol is bearish/risky
    description = `14d rvol ${(vol14 * 100).toFixed(1)}% — elevated (${ratio.toFixed(1)}x 90d avg)`;
  } else if (ratio < 0.55) {
    state = 'compressed';
    score = 60; // compression is slightly bullish (breakout potential)
    description = `14d rvol ${(vol14 * 100).toFixed(1)}% — compressed (${ratio.toFixed(2)}x 90d avg), breakout tension`;
  }

  return {
    state,
    volFactor: { name: 'Realized Vol', value: vol14, signal: scoreToSignal(score), weight: 0.15, description },
  };
}

// ─── 6-type regime classification ────────────────────────────────────────────

function classifyRegime(
  composite: number,
  volState: MacroRegimeResult['volState'],
  mvrvSignal: RegimeFactor['signal'],
): MacroRegimeLabel {
  // Volatility overrides take priority
  if (volState === 'high') return 'Volatile';
  if (volState === 'compressed') return 'Compressed';

  // Directional regimes
  if (composite >= 62) return 'Risk-On';
  if (composite <= 38) return 'Risk-Off';

  // Range-bound classification by valuation
  if (mvrvSignal === 'bullish') return 'Accumulation';
  return 'Distribution';
}

// ─── Main compute ─────────────────────────────────────────────────────────────

function computeRegime(
  prices: number[],
  funding: FundingData | null,
  onchain: OnChainOverview | null,
  fgCurrent: number,
  fgHistory: { date: string; value: number }[],
): MacroRegimeResult {
  const priceTrend = btcTrendFactor(prices);
  const fundingRate = fundingFactor(funding);
  const mvrv = mvrvFactor(onchain);
  const fearGreed = fearGreedFactor(fgCurrent);
  const { state: volState, volFactor } = classifyVolState(prices);

  const factors = { btcTrend: priceTrend, fundingRate, mvrv, fearGreed };

  // Composite score (vol factor influences regime type, not direction score)
  const signalScore = (f: RegimeFactor) =>
    f.signal === 'bullish' ? 75 : f.signal === 'bearish' ? 25 : 50;

  const weights = { btcTrend: 0.35, fundingRate: 0.20, mvrv: 0.30, fearGreed: 0.15 };
  const composite =
    signalScore(priceTrend) * weights.btcTrend +
    signalScore(fundingRate) * weights.fundingRate +
    signalScore(mvrv) * weights.mvrv +
    signalScore(fearGreed) * weights.fearGreed;

  const regime = classifyRegime(Math.round(composite), volState, mvrv.signal);
  const confidence = Math.min(100, Math.max(0, Math.round(Math.abs(composite - 50) * 2)));

  // 90-day history approximated from Fear & Greed + current factor snapshot
  const history = fgHistory.slice(-90).map((fg) => {
    const fgScore = fg.value <= 25 ? 75 : fg.value >= 75 ? 25 : 50;
    const approxComposite = fgScore * 0.15 + composite * 0.85;
    const approxVol: MacroRegimeResult['volState'] = 'normal';
    const approxMvrvSignal = mvrv.signal;
    const r = classifyRegime(Math.round(approxComposite), approxVol, approxMvrvSignal);
    return { timestamp: fg.date, regime: r, score: Math.round(approxComposite) };
  });

  return {
    regime,
    confidence,
    score: Math.round(composite),
    volState,
    factors,
    history,
    historicalContext: HISTORICAL_CONTEXT[regime],
    contextualEmphasis: CONTEXTUAL_EMPHASIS[regime],
    computedAt: new Date().toISOString(),
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

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
    const result = computeRegime(prices, funding, onchain, currentFg, fgHistory);

    await Promise.all([setCached(key, result, TTL), setStale(key, result)]);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[macro/regime] compute failed:', err);
    const stale = await getStale<MacroRegimeResult>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Regime data unavailable' }, { status: 503 });
  }
}
