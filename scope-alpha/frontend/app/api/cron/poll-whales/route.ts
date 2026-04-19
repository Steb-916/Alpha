/**
 * Cron-triggered whale transaction poller — Phase 5 Slice 2.
 *
 * GET /api/cron/poll-whales
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Schedule: every 5 minutes per vercel.json.
 *
 * For each asset (BTC, ETH):
 *   1. Read cursor from Redis (onchain:whales:cursor:{asset}) — last-seen
 *      timestamp in ms. Default: now - 10 minutes on first run.
 *   2. Fetch Whale Alert transactions since cursor (capped by free-tier
 *      3600s lookback inside the provider).
 *   3. Classify each via lib/onchain/classify.ts against the seed list.
 *   4. Append to Redis circular buffer onchain:whales:recent:{asset}
 *      (cap at 500 per asset).
 *   5. Upsert into WhaleTransaction Prisma table (unique on txHash).
 *   6. Update cursor to latest seen timestamp.
 *
 * If WHALE_ALERT_API_KEY is unset, provider.configured is false → the
 * cron returns ok:true with zero work done. No errors.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCached, setCached } from '@/lib/cache/redis';
import { getWhaleProvider } from '@/lib/onchain';
import { classifyTransfer } from '@/lib/onchain/classify';
import type { OnChainAsset, WhaleTransactionRecord } from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS: OnChainAsset[] = ['BTC', 'ETH'];
const BUFFER_CAP = 500;
const BUFFER_TTL = 24 * 60 * 60; // 24h — buffer is reconstructed by subsequent polls.
const CURSOR_TTL = 7 * 24 * 60 * 60; // 7 days.
const DEFAULT_LOOKBACK_MS = 10 * 60 * 1000; // 10 min on first run.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

interface AssetResult {
  asset: OnChainAsset;
  fetched: number;
  classified: number;
  persisted: number;
  skipped: boolean;
  error?: string;
}

async function pollAsset(asset: OnChainAsset): Promise<AssetResult> {
  const result: AssetResult = {
    asset,
    fetched: 0,
    classified: 0,
    persisted: 0,
    skipped: false,
  };

  const provider = getWhaleProvider();
  if (!provider.configured) {
    result.skipped = true;
    return result;
  }

  try {
    const cursorKey = `onchain:whales:cursor:${asset}`;
    const cursor = (await getCached<number>(cursorKey)) ?? Date.now() - DEFAULT_LOOKBACK_MS;

    const transfers = await provider.fetchWhaleTransactions(asset, cursor);
    result.fetched = transfers.length;
    if (transfers.length === 0) return result;

    const classified: WhaleTransactionRecord[] = transfers.map((t) => {
      const c = classifyTransfer(asset, t.fromAddress, t.toAddress);
      return {
        ...t,
        fromLabel: c.fromLabel,
        toLabel: c.toLabel,
        classification: c.classification,
      };
    });
    result.classified = classified.length;

    // Append to circular buffer.
    const bufferKey = `onchain:whales:recent:${asset}`;
    const existing = (await getCached<WhaleTransactionRecord[]>(bufferKey)) ?? [];
    const merged = [...existing, ...classified].slice(-BUFFER_CAP);
    await setCached(bufferKey, merged, BUFFER_TTL);

    // Prisma upsert (txHash-unique).
    let persisted = 0;
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
        persisted += 1;
      } catch (err) {
        console.warn('[poll-whales] upsert failed for', t.txHash, (err as Error).message);
      }
    }
    result.persisted = persisted;

    // Advance cursor to the max timestamp we saw (ms).
    const latestMs = classified.reduce(
      (max, t) => Math.max(max, new Date(t.timestamp).getTime()),
      cursor,
    );
    await setCached(cursorKey, latestMs, CURSOR_TTL);
  } catch (err) {
    result.error = (err as Error).message;
  }

  return result;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const provider = getWhaleProvider();
  const results: AssetResult[] = [];
  for (const asset of ASSETS) {
    results.push(await pollAsset(asset));
  }

  return NextResponse.json({
    ok: true,
    providerConfigured: provider.configured,
    assets: results,
    elapsedMs: Date.now() - startTs,
  });
}
