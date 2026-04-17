/**
 * Multi-exchange aggregation for the slow-metric API routes.
 *
 * Each function fans out REST calls to Binance + Bybit (and optionally OKX)
 * via Promise.allSettled, then merges into the app's existing internal data
 * shapes (FundingData / OpenInterestData / BasisData from `lib/types.ts`).
 *
 * IMPORTANT: The output shapes intentionally match `lib/types.ts` 1:1 so the
 * SWR-backed hooks in useLiveTerminalData.ts can drop these responses
 * straight in without consumer-side renames. The PRD describes a slightly
 * different shape (nested object byExchange); we use the array form because
 * that's what the existing components already render.
 */

import { BinanceConnector } from '@/lib/exchanges/binance';
import { BybitConnector } from '@/lib/exchanges/bybit';
import type {
  FundingRate as ExchangeFundingRate,
  OpenInterest as ExchangeOpenInterest,
} from '@/lib/exchanges/types';
import type {
  FundingData,
  OpenInterestData,
  BasisData,
} from '@/lib/types';
import { resolveAsset } from '@/config/assets';
import { getCached, setCached } from '@/lib/cache/redis';
import {
  persistFundingSnapshot,
  persistOISnapshot,
} from '@/lib/market/persistence';

// Singletons — these classes are stateless for REST so cheap to share.
const binance = new BinanceConnector();
const bybit = new BybitConnector();

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance =
    xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/**
 * Resolve a user-supplied symbol (BTC | BTCUSDT) to its per-exchange ids.
 * Throws if the symbol is not in the supported asset list.
 */
function resolveSymbols(input: string): {
  app: string;
  binance: string;
  bybit: string;
} {
  const cfg = resolveAsset(input);
  if (!cfg) {
    throw new Error(`Unsupported symbol: ${input}`);
  }
  return { app: cfg.symbol, binance: cfg.binance, bybit: cfg.bybit };
}

// ─── Funding ────────────────────────────────────────────────────────────────

export async function aggregateFunding(symbol: string): Promise<FundingData> {
  const sym = resolveSymbols(symbol);

  const [
    binanceCurrentRes,
    binanceHistRes,
    bybitCurrentRes,
    bybitHistRes,
  ] = await Promise.allSettled([
    binance.getFundingRate(sym.binance),
    binance.getFundingRateHistory(sym.binance, 90),
    bybit.getFundingRate(sym.bybit),
    bybit.getFundingRateHistory(sym.bybit, 90),
  ]);

  const binanceCurrent =
    binanceCurrentRes.status === 'fulfilled' ? binanceCurrentRes.value : null;
  const binanceHist: ExchangeFundingRate[] =
    binanceHistRes.status === 'fulfilled' ? binanceHistRes.value : [];
  const bybitCurrent =
    bybitCurrentRes.status === 'fulfilled' ? bybitCurrentRes.value : null;
  const bybitHist: ExchangeFundingRate[] =
    bybitHistRes.status === 'fulfilled' ? bybitHistRes.value : [];

  if (!binanceCurrent && !bybitCurrent) {
    throw new Error(`aggregateFunding(${symbol}): all exchanges failed`);
  }

  // Use Binance as primary "currentRate" because it has the deepest liquidity.
  const primary = binanceCurrent ?? bybitCurrent!;
  const currentRate = safeNumber(primary.fundingRate);

  // avg8h = mean of last 3 historical records (each is one 8hr period).
  const histRates = (binanceHist.length >= 3 ? binanceHist : bybitHist)
    .map((h) => safeNumber(h.fundingRate))
    .filter((r) => Number.isFinite(r));
  const last3 = histRates.slice(-3);
  const avg8h = last3.length ? mean(last3) : currentRate;

  // zScore over the full ~90-record window.
  const m = mean(histRates);
  const sd = stddev(histRates) || 0.000001;
  const zScore = histRates.length >= 5 ? (currentRate - m) / sd : 0;

  // Annualized carry: rate × 3 funding periods/day × 365 days × 100 (to %)
  const annualizedCarry = currentRate * 3 * 365 * 100;

  // History array for charting — prefer Binance (90 records ≈ 30 days).
  const historySource = binanceHist.length ? binanceHist : bybitHist;
  const history = historySource.map((h) => ({
    time: h.fundingTime, // already in ms
    rate: safeNumber(h.fundingRate),
  }));

  const byExchange: FundingData['byExchange'] = [];
  if (binanceCurrent) {
    byExchange.push({
      exchange: 'Binance',
      rate: safeNumber(binanceCurrent.fundingRate),
    });
  }
  if (bybitCurrent) {
    byExchange.push({
      exchange: 'Bybit',
      rate: safeNumber(bybitCurrent.fundingRate),
    });
  }

  // Fire-and-forget: persist a funding snapshot per exchange. Idempotent via
  // @@unique(asset, exchange, timestamp) — repeated calls with the same
  // funding-event timestamp are no-ops.
  if (binanceCurrent && binanceCurrent.fundingTime) {
    // The exchange connector strips indexPrice to keep the interface tight;
    // fall back to markPrice as the best-effort index value. Phase 2 work can
    // enrich binance.ts to preserve indexPrice end-to-end.
    void persistFundingSnapshot({
      asset: sym.app,
      exchange: 'binance',
      rate: safeNumber(binanceCurrent.fundingRate),
      markPrice: safeNumber(binanceCurrent.markPrice),
      indexPrice: safeNumber(binanceCurrent.markPrice),
      timestamp: new Date(binanceCurrent.fundingTime),
    });
  }
  if (bybitCurrent && bybitCurrent.nextFundingTime) {
    // Bybit exposes only nextFundingTime on the ticker; the most recent past
    // funding event is 8h before that.
    const eightH = 8 * 60 * 60 * 1000;
    void persistFundingSnapshot({
      asset: sym.app,
      exchange: 'bybit',
      rate: safeNumber(bybitCurrent.fundingRate),
      markPrice: safeNumber(bybitCurrent.markPrice),
      indexPrice: safeNumber(bybitCurrent.markPrice), // best-effort fallback
      timestamp: new Date(bybitCurrent.nextFundingTime - eightH),
    });
  }

  return {
    symbol: sym.app,
    currentRate,
    avg8h,
    zScore,
    annualizedCarry,
    history,
    byExchange,
  };
}

// ─── Open Interest ──────────────────────────────────────────────────────────

const OI_PREV_KEY = (s: string) => `market:oi:prev:${s}`;
const OI_PREV_TTL = 24 * 60 * 60; // 24 hours

interface OIPrev {
  value: number;
  ts: number;
}

export async function aggregateOI(symbol: string): Promise<OpenInterestData> {
  const sym = resolveSymbols(symbol);

  const [binanceRes, bybitRes, binanceHistRes] = await Promise.allSettled([
    binance.getOpenInterest(sym.binance),
    bybit.getOpenInterest(sym.bybit),
    binance.getOpenInterestHistory(sym.binance, '1h', 25), // 25 = 24h ago + now
  ]);

  const binanceOI: ExchangeOpenInterest | null =
    binanceRes.status === 'fulfilled' ? binanceRes.value : null;
  const bybitOI: ExchangeOpenInterest | null =
    bybitRes.status === 'fulfilled' ? bybitRes.value : null;
  const binanceHist: ExchangeOpenInterest[] =
    binanceHistRes.status === 'fulfilled' ? binanceHistRes.value : [];

  if (!binanceOI && !bybitOI) {
    throw new Error(`aggregateOI(${symbol}): all exchanges failed`);
  }

  // Aggregate uses USD value when available, falls back to contracts.
  const binanceVal = binanceOI
    ? safeNumber(binanceOI.openInterestValue) ||
      safeNumber(binanceOI.openInterest)
    : 0;
  const bybitVal = bybitOI
    ? safeNumber(bybitOI.openInterestValue) || safeNumber(bybitOI.openInterest)
    : 0;
  const aggregateOI = binanceVal + bybitVal;

  // 24h delta from Binance hourly history. Hist is sorted oldest → newest.
  let change24h = 0;
  if (binanceHist.length >= 2) {
    const oldest = binanceHist[0];
    const newest = binanceHist[binanceHist.length - 1];
    const oldVal =
      safeNumber(oldest.openInterestValue) ||
      safeNumber(oldest.openInterest);
    const newVal =
      safeNumber(newest.openInterestValue) ||
      safeNumber(newest.openInterest);
    if (oldVal > 0) {
      change24h = ((newVal - oldVal) / oldVal) * 100;
    }
  } else {
    // Fallback: compare to stored "previous" snapshot from cache.
    const prev = await getCached<OIPrev>(OI_PREV_KEY(sym.binance));
    if (prev && prev.value > 0) {
      change24h = ((aggregateOI - prev.value) / prev.value) * 100;
    }
    // Update the rolling snapshot if we don't have one or it's >12h old.
    if (!prev || Date.now() - prev.ts > 12 * 60 * 60 * 1000) {
      await setCached<OIPrev>(
        OI_PREV_KEY(sym.binance),
        { value: aggregateOI, ts: Date.now() },
        OI_PREV_TTL,
      );
    }
  }

  // 1h / 4h pseudo-deltas from history if available.
  let change1h = 0;
  let change4h = 0;
  if (binanceHist.length >= 5) {
    const newest = binanceHist[binanceHist.length - 1];
    const newVal =
      safeNumber(newest.openInterestValue) ||
      safeNumber(newest.openInterest);

    const h1 = binanceHist[binanceHist.length - 2];
    const h1v = safeNumber(h1.openInterestValue) || safeNumber(h1.openInterest);
    if (h1v > 0) change1h = ((newVal - h1v) / h1v) * 100;

    const h4Idx = Math.max(0, binanceHist.length - 5);
    const h4 = binanceHist[h4Idx];
    const h4v = safeNumber(h4.openInterestValue) || safeNumber(h4.openInterest);
    if (h4v > 0) change4h = ((newVal - h4v) / h4v) * 100;
  }

  const history = binanceHist.map((h) => ({
    time: h.timestamp,
    value: safeNumber(h.openInterestValue) || safeNumber(h.openInterest),
  }));

  const byExchange: OpenInterestData['byExchange'] = [];
  if (binanceOI) byExchange.push({ exchange: 'Binance', value: binanceVal });
  if (bybitOI) byExchange.push({ exchange: 'Bybit', value: bybitVal });

  // Fire-and-forget: persist hourly OI snapshot per exchange. The persistence
  // helper floors to the hour so repeated calls within the same hour are no-ops.
  const nowTs = new Date();
  if (binanceOI) {
    const binanceContracts = safeNumber(binanceOI.openInterest);
    const binanceUsd = safeNumber(binanceOI.openInterestValue);
    const binancePrice =
      binanceUsd > 0 && binanceContracts > 0
        ? binanceUsd / binanceContracts
        : 0;
    void persistOISnapshot({
      asset: sym.app,
      exchange: 'binance',
      oi: binanceContracts,
      oiUsd: binanceUsd || binanceContracts * binancePrice,
      price: binancePrice,
      timestamp: nowTs,
    });
  }
  if (bybitOI) {
    const bybitContracts = safeNumber(bybitOI.openInterest);
    const bybitUsd = safeNumber(bybitOI.openInterestValue);
    void persistOISnapshot({
      asset: sym.app,
      exchange: 'bybit',
      oi: bybitContracts,
      oiUsd: bybitUsd,
      price: bybitUsd > 0 && bybitContracts > 0 ? bybitUsd / bybitContracts : 0,
      timestamp: nowTs,
    });
  }

  return {
    symbol: sym.app,
    aggregateOI,
    change1h,
    change4h,
    change24h,
    history,
    byExchange,
  };
}

// ─── Basis ──────────────────────────────────────────────────────────────────

/**
 * Perpetual basis = (markPrice - indexPrice) / indexPrice * 100.
 *
 * Binance exposes both markPrice and indexPrice on /fapi/v1/premiumIndex.
 * Bybit exposes them on /v5/market/tickers (markPrice + indexPrice).
 *
 * The annualizedBasis is computed from the funding-implied carry — for perps
 * there's no real "days to expiry" — so we estimate using the funding rate
 * (rate × 3 × 365 × 100). This matches how the mock generator and the rest
 * of the app reason about basis.
 */

interface RawBasisLeg {
  markPrice: number;
  indexPrice: number;
  basisPct: number;
}

async function fetchBinanceBasis(symbol: string): Promise<RawBasisLeg | null> {
  try {
    const url = new URL(
      '/fapi/v1/premiumIndex',
      process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com',
    );
    url.searchParams.set('symbol', symbol);
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { markPrice: string; indexPrice: string }
      | Array<{ markPrice: string; indexPrice: string }>;
    const item = Array.isArray(json) ? json[0] : json;
    if (!item) return null;
    const mark = parseFloat(item.markPrice);
    const index = parseFloat(item.indexPrice);
    if (!Number.isFinite(mark) || !Number.isFinite(index) || index === 0) {
      return null;
    }
    return {
      markPrice: mark,
      indexPrice: index,
      basisPct: ((mark - index) / index) * 100,
    };
  } catch {
    return null;
  }
}

async function fetchBybitBasis(symbol: string): Promise<RawBasisLeg | null> {
  try {
    const url = new URL(
      '/v5/market/tickers',
      process.env.BYBIT_REST_URL || 'https://api.bybit.com',
    );
    url.searchParams.set('category', 'linear');
    url.searchParams.set('symbol', symbol);
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      retCode?: number;
      result?: { list?: Array<{ markPrice?: string; indexPrice?: string }> };
    };
    if (json.retCode !== 0) return null;
    const t = json.result?.list?.[0];
    if (!t) return null;
    const mark = parseFloat(t.markPrice ?? '0');
    const index = parseFloat(t.indexPrice ?? '0');
    if (!Number.isFinite(mark) || !Number.isFinite(index) || index === 0) {
      return null;
    }
    return {
      markPrice: mark,
      indexPrice: index,
      basisPct: ((mark - index) / index) * 100,
    };
  } catch {
    return null;
  }
}

export async function aggregateBasis(symbol: string): Promise<BasisData> {
  const sym = resolveSymbols(symbol);

  const [binanceLegRes, bybitLegRes, fundingRes] = await Promise.allSettled([
    fetchBinanceBasis(sym.binance),
    fetchBybitBasis(sym.bybit),
    binance.getFundingRate(sym.binance),
  ]);

  const binanceLeg =
    binanceLegRes.status === 'fulfilled' ? binanceLegRes.value : null;
  const bybitLeg =
    bybitLegRes.status === 'fulfilled' ? bybitLegRes.value : null;
  const funding = fundingRes.status === 'fulfilled' ? fundingRes.value : null;

  if (!binanceLeg && !bybitLeg) {
    throw new Error(`aggregateBasis(${symbol}): all exchanges failed`);
  }

  // Primary basis = Binance if present, else Bybit.
  const primary = binanceLeg ?? bybitLeg!;
  const currentBasis = primary.basisPct;

  // Funding-implied annualized rate (perp convention).
  const annualizedBasis = funding
    ? safeNumber(funding.fundingRate) * 3 * 365 * 100
    : currentBasis * 4; // fallback to 4× quarterly approximation

  const byExchange: BasisData['byExchange'] = [];
  if (binanceLeg) {
    byExchange.push({ exchange: 'Binance', basis: binanceLeg.basisPct });
  }
  if (bybitLeg) {
    byExchange.push({ exchange: 'Bybit', basis: bybitLeg.basisPct });
  }

  return {
    symbol: sym.app,
    currentBasis,
    annualizedBasis,
    history: [], // history is rebuilt by the cron warmer from cached snapshots
    byExchange,
  };
}
