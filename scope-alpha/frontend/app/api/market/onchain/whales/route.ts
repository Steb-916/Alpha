/**
 * GET /api/market/onchain/whales?asset=BTC
 *
 * Hobby-plan refactor (Phase 6). On-demand fetch replacing the previous
 * poll-whales cron (which violated Hobby's daily-only cron rule). Behavior:
 *
 *   1. Cache-first read on `onchain:whales:recent:{asset}` (300s TTL — 5 min).
 *      Whale transfers are a monitoring view; 5-min staleness is imperceptible,
 *      and the Whale Alert endpoint returns the full 1h lookback window on
 *      every fetch — re-fetching every minute would burn quota for zero UX gain.
 *   2. Cache miss → Whale Alert fetch (1h lookback, free-tier retention limit).
 *   3. Classify each transfer via lib/onchain/classify.ts against the seed list.
 *   4. Upsert each into WhaleTransaction (txHash unique → dedupe across sessions).
 *   5. Store classified array in Redis with 300s TTL.
 *   6. Build + return the OnChainWhalesResponse envelope.
 *
 * First user per 5-min window pays ~1-2s latency; everyone else gets cache.
 * Inert-mode: when WHALE_ALERT_API_KEY is unset, provider.configured is false
 * and the route returns an empty envelope without fetching or persisting —
 * UI empty-state + "Whale Alert not configured" banner unchanged.
 */

import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { getWhaleProvider } from '@/lib/onchain';
import { classifyTransfer, seedVersion } from '@/lib/onchain/classify';
import type {
  OnChainAsset,
  OnChainWhalesResponse,
  WhaleTransactionRecord,
} from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const CACHE_TTL_SECONDS = 300;
const BUFFER_CAP = 500;
const ONE_HOUR_MS = 60 * 60 * 1000;

function bufferKey(asset: OnChainAsset): string {
  return `onchain:whales:recent:${asset}`;
}

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

  // Cache-first
  const cached = await getCached<WhaleTransactionRecord[]>(bufferKey(asset));
  if (cached) {
    const overlay: OnChainWhalesResponse = {
      asset,
      recent: cached.slice().reverse(), // newest first
      summary24h: summarize24h(cached),
      provider_configured: provider.configured,
      seedListVersion: seedVersion(asset),
    };
    return NextResponse.json(overlay);
  }

  // Inert mode — provider not configured → return empty envelope; do not
  // hit the Whale Alert endpoint and do not persist to Prisma.
  if (!provider.configured) {
    const empty: WhaleTransactionRecord[] = [];
    const overlay: OnChainWhalesResponse = {
      asset,
      recent: empty,
      summary24h: summarize24h(empty),
      provider_configured: false,
      seedListVersion: seedVersion(asset),
    };
    return NextResponse.json(overlay);
  }

  // Fetch the last 1h of whale transfers
  const sinceMs = Date.now() - ONE_HOUR_MS;
  const fetched = await provider.fetchWhaleTransactions(asset, sinceMs);

  // Classify each transfer (dedupe/label via seed list)
  const classified: WhaleTransactionRecord[] = fetched.map((t) => {
    const c = classifyTransfer(asset, t.fromAddress, t.toAddress);
    return {
      ...t,
      fromLabel: c.fromLabel,
      toLabel: c.toLabel,
      classification: c.classification,
    };
  });

  // Persist to WhaleTransaction (txHash unique → cross-session dedupe).
  // Each user visit that produces new whales writes them once; repeat visits
  // with the same hashes are no-ops. Best-effort — don't fail the route if
  // persistence hiccups.
  for (const t of classified) {
    if (!t.txHash) continue;
    try {
      await prisma.whaleTransaction.upsert({
        where: { txHash: t.txHash },
        create: {
          asset: t.asset,
          valueUsd: t.valueUsd,
          fromAddress: t.fromAddress,
          toAddress: t.toAddress,
          fromLabel: t.fromLabel,
          toLabel: t.toLabel,
          classification: t.classification,
          txHash: t.txHash,
          timestamp: new Date(t.timestamp),
        },
        update: {},
      });
    } catch (err) {
      console.warn(
        '[onchain/whales] upsert failed for',
        t.txHash,
        (err as Error).message,
      );
    }
  }

  // Cache the classified buffer for 5 min (cap at BUFFER_CAP newest entries)
  const capped = classified.slice(-BUFFER_CAP);
  await setCached(bufferKey(asset), capped, CACHE_TTL_SECONDS);

  const overlay: OnChainWhalesResponse = {
    asset,
    recent: capped.slice().reverse(),
    summary24h: summarize24h(capped),
    provider_configured: true,
    seedListVersion: seedVersion(asset),
  };
  return NextResponse.json(overlay);
}
