/**
 * GEX, DEX, Vanna, and Charm exposure computations.
 *
 * All Greeks are derived analytically via Black-Scholes using each
 * instrument's markIV, since Deribit's BookSummary endpoint does not
 * return greeks. Results are directionally accurate for positioning analysis.
 *
 * GEX convention (dealer perspective):
 *   Calls: dealers are typically short calls → short gamma → putGex negative
 *   Puts:  dealers are typically long puts  → long gamma  → putGex positive
 *   Net GEX positive = dealers net long gamma = stabilizing
 *   Net GEX negative = dealers net short gamma = amplifying
 *
 * GEX unit: USD-gamma (dollar move per 1% move in spot squared), which is
 *   gamma_bs × OI_contracts × spot² × 0.01
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type {
  GexByStrike,
  DexByStrike,
  VannaCharmExposure,
  GexStrike,
} from '@/types/options';
import {
  computeGamma,
  computeDelta,
  computeVanna,
  computeCharm,
} from './black-scholes';

const RISK_FREE_RATE = 0.05;

function toDecimalVol(markIV: number): number {
  return markIV / 100;
}

function toYears(daysToExpiry: number): number {
  return Math.max(daysToExpiry, 0.5) / 365;
}

// ─── GEX ──────────────────────────────────────────────────────────────────────

export function computeGexByStrike(chain: OptionsChainEntry[]): GexByStrike {
  const now = new Date().toISOString();
  const spot = chain[0]?.underlyingPrice ?? 0;

  // Accumulate per strike
  const strikeMap = new Map<number, { callGex: number; putGex: number }>();

  for (const c of chain) {
    if (c.daysToExpiry <= 0) continue;
    const sigma = toDecimalVol(c.markIV);
    const T = toYears(c.daysToExpiry);
    const gamma = computeGamma(spot, c.strike, T, RISK_FREE_RATE, sigma);
    // USD-denominated: gamma × OI × spot² × 0.01
    const gexRaw = gamma * c.openInterest * spot * spot * 0.01;

    const existing = strikeMap.get(c.strike) ?? { callGex: 0, putGex: 0 };
    if (c.optionType === 'call') {
      // Dealers short calls → negative GEX contribution
      existing.callGex -= gexRaw;
    } else {
      // Dealers long puts → positive GEX contribution
      existing.putGex += gexRaw;
    }
    strikeMap.set(c.strike, existing);
  }

  const strikes: GexStrike[] = Array.from(strikeMap.entries())
    .map(([strike, { callGex, putGex }]) => ({
      strike,
      netGex: callGex + putGex,
      callGex,
      putGex,
    }))
    .sort((a, b) => a.strike - b.strike);

  // Gamma flip: strike where cumulative net GEX crosses zero (ascending)
  let cumGex = 0;
  let gammaFlip: number | null = null;
  for (const s of strikes) {
    const prevSign = Math.sign(cumGex);
    cumGex += s.netGex;
    if (prevSign !== 0 && Math.sign(cumGex) !== prevSign) {
      gammaFlip = s.strike;
      break;
    }
  }

  const totalNetGex = strikes.reduce((sum, s) => sum + s.netGex, 0);
  const asset = chain[0]?.asset ?? '';

  return {
    asset,
    timestamp: now,
    spot,
    gammaFlip,
    netGammaRegime: totalNetGex >= 0 ? 'positive' : 'negative',
    totalNetGex,
    strikes,
  };
}

// ─── DEX ──────────────────────────────────────────────────────────────────────

export function computeDexByStrike(chain: OptionsChainEntry[]): DexByStrike {
  const now = new Date().toISOString();
  const spot = chain[0]?.underlyingPrice ?? 0;

  const strikeMap = new Map<number, { callDex: number; putDex: number }>();

  for (const c of chain) {
    if (c.daysToExpiry <= 0) continue;
    const sigma = toDecimalVol(c.markIV);
    const T = toYears(c.daysToExpiry);
    const delta = computeDelta(spot, c.strike, T, RISK_FREE_RATE, sigma, c.optionType);
    // USD-denominated delta exposure: delta × OI × spot
    const dexRaw = delta * c.openInterest * spot;

    const existing = strikeMap.get(c.strike) ?? { callDex: 0, putDex: 0 };
    if (c.optionType === 'call') {
      existing.callDex += dexRaw;
    } else {
      existing.putDex += dexRaw;
    }
    strikeMap.set(c.strike, existing);
  }

  const strikes = Array.from(strikeMap.entries())
    .map(([strike, { callDex, putDex }]) => ({
      strike,
      netDex: callDex + putDex,
      callDex,
      putDex,
    }))
    .sort((a, b) => a.strike - b.strike);

  const totalNetDex = strikes.reduce((sum, s) => sum + s.netDex, 0);
  const BALANCED_THRESHOLD = 0.1 * Math.abs(totalNetDex || 1);
  let deltaRegime: 'call-heavy' | 'put-heavy' | 'balanced';
  if (Math.abs(totalNetDex) < BALANCED_THRESHOLD) {
    deltaRegime = 'balanced';
  } else {
    deltaRegime = totalNetDex > 0 ? 'call-heavy' : 'put-heavy';
  }

  return {
    asset: chain[0]?.asset ?? '',
    timestamp: now,
    spot,
    totalNetDex,
    deltaRegime,
    strikes,
  };
}

// ─── Vanna / Charm ─────────────────────────────────────────────────────────────

export function computeVannaCharm(chain: OptionsChainEntry[]): VannaCharmExposure {
  const now = new Date().toISOString();
  const spot = chain[0]?.underlyingPrice ?? 0;

  type StrikeKey = string; // `${strike}:${expiration_iso}`
  const strikeMap = new Map<
    StrikeKey,
    {
      strike: number;
      expiration: string;
      daysToExpiry: number;
      vanna: number;
      charm: number;
    }
  >();

  for (const c of chain) {
    if (c.daysToExpiry <= 0) continue;
    const sigma = toDecimalVol(c.markIV);
    const T = toYears(c.daysToExpiry);
    const vannaVal = computeVanna(spot, c.strike, T, RISK_FREE_RATE, sigma);
    const charmVal = computeCharm(spot, c.strike, T, RISK_FREE_RATE, sigma, c.optionType);

    // Scale by OI so the aggregate reflects positioning size
    const scaledVanna = vannaVal * c.openInterest;
    const scaledCharm = charmVal * c.openInterest;

    const expiryIso = c.expirationDate.toISOString().slice(0, 10);
    const key: StrikeKey = `${c.strike}:${expiryIso}`;

    const existing = strikeMap.get(key) ?? {
      strike: c.strike,
      expiration: expiryIso,
      daysToExpiry: c.daysToExpiry,
      vanna: 0,
      charm: 0,
    };
    existing.vanna += scaledVanna;
    existing.charm += scaledCharm;
    strikeMap.set(key, existing);
  }

  const strikesArr = Array.from(strikeMap.values()).sort((a, b) =>
    a.strike !== b.strike ? a.strike - b.strike : a.daysToExpiry - b.daysToExpiry,
  );

  const vannaNet = strikesArr.reduce((s, r) => s + r.vanna, 0);
  const charmNet = strikesArr.reduce((s, r) => s + r.charm, 0);

  return {
    asset: chain[0]?.asset ?? '',
    timestamp: now,
    spot,
    strikes: strikesArr,
    vannaNet,
    charmNet,
  };
}
