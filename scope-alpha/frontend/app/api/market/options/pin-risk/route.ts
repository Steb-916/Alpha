/**
 * GET /api/market/options/pin-risk?asset=BTC&expiry=YYYY-MM-DD
 *
 * Max pain + pin-risk assessment for a given expiration. Computed on
 * demand from the cached chain — no compute-intensive work, so no
 * caching needed.
 *
 * When no expiry is supplied, the nearest-to-expiry expiration is used.
 */

import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import { computePinRisk } from '@/lib/options/pin-risk';
import type {
  DeribitCurrency,
  OptionsChainEntry,
} from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const expiryParam = url.searchParams.get('expiry');

  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'Pin risk only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;

  // Load chain from cache; warm if cold.
  let chain =
    (await getCached<OptionsChainEntry[]>(`options:chain:${currency}`)) ??
    null;
  if (!chain || chain.length === 0) {
    const warmed = await warmChainCache(currency);
    chain = warmed.chain.length > 0 ? warmed.chain : null;
    if (!chain) {
      chain =
        (await getCached<OptionsChainEntry[]>(`options:chain:${currency}`)) ??
        null;
    }
  }
  if (!chain || chain.length === 0) {
    return NextResponse.json(
      { error: 'Options chain temporarily unavailable', asset: currency },
      { status: 503 },
    );
  }

  // Rehydrate expirationDate from JSON (cache stored as ISO string).
  const normalized = chain.map((c) => ({
    ...c,
    expirationDate:
      c.expirationDate instanceof Date
        ? c.expirationDate
        : new Date(c.expirationDate as unknown as string),
  }));

  let expirationDate: Date;
  if (expiryParam && /^\d{4}-\d{2}-\d{2}$/.test(expiryParam)) {
    // Match by calendar date — Deribit options expire at 08:00 UTC so the
    // stored ISO begins with the same YYYY-MM-DD.
    const match = normalized.find((c) =>
      c.expirationDate.toISOString().startsWith(expiryParam),
    );
    if (!match) {
      return NextResponse.json(
        { error: `No chain entries for expiry ${expiryParam}` },
        { status: 404 },
      );
    }
    expirationDate = match.expirationDate;
  } else {
    // Nearest expiry in the future.
    const future = normalized
      .filter((c) => c.daysToExpiry > 0)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
    if (future.length === 0) {
      return NextResponse.json(
        { error: 'No future expirations available' },
        { status: 503 },
      );
    }
    expirationDate = future[0].expirationDate;
  }

  const result = computePinRisk({
    asset: currency,
    chain: normalized,
    expirationDate,
  });
  if (!result) {
    return NextResponse.json(
      { error: 'Pin risk could not be computed (sparse chain for expiry)' },
      { status: 503 },
    );
  }
  return NextResponse.json(result);
}
