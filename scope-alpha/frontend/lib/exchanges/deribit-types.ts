/**
 * Deribit API response shapes + internal options representation.
 *
 * Deribit quirks to remember:
 *   - `mark_iv` is in percentage points (52.3 = 52.3%), not decimal.
 *   - `mark_price` is in the underlying currency (BTC, ETH). Multiply by
 *     `underlying_price` (USD) to get USD notional.
 *   - Instrument names follow `{ASSET}-{EXPIRY}-{STRIKE}-{TYPE}`, e.g.
 *     `BTC-28MAR26-90000-C`. Expiry is a three-letter month + two-digit year.
 */

export type DeribitCurrency = 'BTC' | 'ETH';

export interface DeribitInstrument {
  instrument_name: string;
  strike: number;
  expiration_timestamp: number; // ms since epoch
  option_type: 'call' | 'put';
  base_currency: string;
  quote_currency: string;
}

export interface DeribitBookSummary {
  instrument_name: string;
  underlying_price: number;
  mark_price: number; // In base currency (BTC/ETH)
  mark_iv: number;    // Percentage (e.g., 52.3)
  bid_price: number | null;
  ask_price: number | null;
  bid_iv: number | null;
  ask_iv: number | null;
  open_interest: number;
  volume: number;
  // Deribit also returns last, high, low, etc. — not needed here.
}

export interface DeribitOrderBook {
  instrument_name: string;
  underlying_price: number;
  mark_price: number;
  mark_iv: number;
  greeks?: {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
    rho: number;
  };
}

/**
 * Internal, normalized options chain entry — what the rest of the app uses.
 * Produced by `lib/options/chain-parser.ts` from Deribit book summaries +
 * parsed instrument names.
 */
export interface OptionsChainEntry {
  asset: string;              // "BTC" or "ETH"
  instrumentName: string;     // "BTC-28MAR26-90000-C"
  strike: number;
  expirationDate: Date;
  daysToExpiry: number;
  optionType: 'call' | 'put';

  markPrice: number;          // In USD
  markIV: number;             // Percentage points
  bidIV: number | null;
  askIV: number | null;
  underlyingPrice: number;    // Spot in USD

  openInterest: number;
  volume24h: number;

  delta: number | null;
  gamma: number | null;
  vega: number | null;
  theta: number | null;
}

export interface DeribitVolHistoryPoint {
  timestamp: number;
  value: number; // Realized volatility (annualized %, Deribit scale)
}
