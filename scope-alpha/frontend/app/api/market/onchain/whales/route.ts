/**
 * GET /api/market/onchain/whales?asset=BTC
 *
 * Reads the Redis circular buffer populated by poll-whales cron.
 * Does not fetch at request time — avoids Whale Alert's 1 req/sec limit
 * from user requests. Returns {recent, summary24h, ...}.
 */

import { NextResponse } from 'next/server';
import { getCached } from '@/lib/cache/redis';
import { getWhaleProvider } from '@/lib/onchain';
import { seedVersion } from '@/lib/onchain/classify';
import type {
  OnChainAsset,
  OnChainWhalesResponse,
  WhaleTransactionRecord,
} from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);

function summarize24h(recent: WhaleTransactionRecord[]) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let total = 0;
  let toExchangeUsd = 0;
  let fromExchangeUsd = 0;
  let walletToWalletUsd = 0;
  for (const t of recent) {
    if (new Date(t.timestamp).getTime() < cutoff) continue;
    total += 1;
    if (t.classification === 'to_exchange') toExchangeUsd += t.valueUsd;
    else if (t.classification === 'from_exchange') fromExchangeUsd += t.valueUsd;
    else walletToWalletUsd += t.valueUsd;
  }
  return { total, toExchangeUsd, fromExchangeUsd, walletToWalletUsd };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(raw as OnChainAsset)) {
    return NextResponse.json(
      { error: 'Whale data only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = raw as OnChainAsset;
  const provider = getWhaleProvider();

  const bufferKey = `onchain:whales:recent:${asset}`;
  const recent = (await getCached<WhaleTransactionRecord[]>(bufferKey)) ?? [];

  const overlay: OnChainWhalesResponse = {
    asset,
    recent: recent.slice().reverse(), // newest first for display
    summary24h: summarize24h(recent),
    provider_configured: provider.configured,
    seedListVersion: seedVersion(asset),
  };
  return NextResponse.json(overlay);
}
