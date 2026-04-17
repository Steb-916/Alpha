/**
 * Parse Deribit book summary rows into normalized OptionsChainEntry[].
 *
 * Deribit instrument names follow the convention:
 *   {ASSET}-{DDMMMYY}-{STRIKE}-{TYPE}
 * Example: "BTC-28MAR26-90000-C" → BTC call, $90k strike, expires 28-Mar-2026
 *
 * Quirks:
 *   - `mark_iv` is already an annualized percentage (e.g., 52.3 = 52.3%).
 *     Keep the percentage scale through persistence + display.
 *   - `mark_price` is quoted in the underlying currency. We multiply by
 *     `underlying_price` (USD) to produce a USD mark.
 *   - Instruments with no bid AND no ask (fully illiquid) are dropped.
 *   - Instruments with OI < 1 are dropped.
 */

import type {
  DeribitBookSummary,
  OptionsChainEntry,
} from '@/lib/exchanges/deribit-types';

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export interface ParsedInstrument {
  asset: string;
  strike: number;
  expirationDate: Date;
  optionType: 'call' | 'put';
}

export function parseInstrumentName(name: string): ParsedInstrument | null {
  const parts = name.trim().toUpperCase().split('-');
  if (parts.length < 4) return null;
  const [asset, expiryStr, strikeStr, typeStr] = parts;

  // Expiry format: DDMMMYY (e.g., "28MAR26" → 2026-03-28)
  const match = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(expiryStr);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2]];
  if (month === undefined) return null;
  const year = 2000 + parseInt(match[3], 10);
  // Deribit options expire at 08:00 UTC on the expiration date
  const expirationDate = new Date(Date.UTC(year, month, day, 8, 0, 0));

  const strike = parseFloat(strikeStr);
  if (!Number.isFinite(strike)) return null;

  let optionType: 'call' | 'put';
  if (typeStr === 'C') optionType = 'call';
  else if (typeStr === 'P') optionType = 'put';
  else return null;

  return { asset, strike, expirationDate, optionType };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ParseChainOptions {
  /** Drop instruments whose bid AND ask are both null. Default true. */
  dropIlliquid?: boolean;
  /** Minimum open interest required to keep the instrument. Default 1. */
  minOpenInterest?: number;
}

export function parseBookSummaries(
  asset: string,
  summaries: DeribitBookSummary[],
  opts: ParseChainOptions = {},
): OptionsChainEntry[] {
  const dropIlliquid = opts.dropIlliquid ?? true;
  const minOI = opts.minOpenInterest ?? 1;
  const now = Date.now();

  const entries: OptionsChainEntry[] = [];
  for (const s of summaries) {
    const parsed = parseInstrumentName(s.instrument_name);
    if (!parsed) continue;
    if (parsed.asset !== asset) continue;

    if (dropIlliquid && s.bid_price == null && s.ask_price == null) continue;
    if ((s.open_interest ?? 0) < minOI) continue;
    if (!Number.isFinite(s.mark_iv) || s.mark_iv <= 0) continue;

    const daysToExpiry = Math.max(
      0,
      (parsed.expirationDate.getTime() - now) / MS_PER_DAY,
    );

    const underlyingUsd = s.underlying_price ?? 0;
    const markUsd = (s.mark_price ?? 0) * underlyingUsd;

    entries.push({
      asset: parsed.asset,
      instrumentName: s.instrument_name,
      strike: parsed.strike,
      expirationDate: parsed.expirationDate,
      daysToExpiry,
      optionType: parsed.optionType,
      markPrice: markUsd,
      markIV: s.mark_iv,
      bidIV: s.bid_iv,
      askIV: s.ask_iv,
      underlyingPrice: underlyingUsd,
      openInterest: s.open_interest ?? 0,
      volume24h: s.volume ?? 0,
      delta: null,
      gamma: null,
      vega: null,
      theta: null,
    });
  }
  return entries;
}
