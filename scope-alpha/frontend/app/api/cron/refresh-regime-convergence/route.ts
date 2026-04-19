/**
 * Cron-triggered regime + convergence refresh — Phase 6.
 *
 * GET /api/cron/refresh-regime-convergence
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Schedule: hourly (0 * * * *). Must run AFTER the Phase 1–5 data crons
 * that populate the domain caches this classifier reads.
 *
 * Slice 1 scope (regime portion):
 *   For each BTC/ETH:
 *     1. Read previous RegimeSnapshot (persistence-filter context).
 *     2. Assemble cache snapshot → build feature vector.
 *     3. Call quantEngine.classifyRegime with prev context.
 *     4. Upsert new RegimeSnapshot.
 *     5. Warm regime:current:{asset} cache.
 *
 * TODO(Slice 2): convergence-score portion — per-domain scores + composite.
 * TODO(Slice 1 daily branch): at UTC hour 0, recompute forward-return
 *   distributions per regime and warm regime:forward_returns:{asset}:{regime}.
 */

import { NextResponse } from 'next/server';
import { setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { quantEngine } from '@/lib/quant-engine';
import {
  assembleCacheSnapshot,
  buildFeatureVectorFromSnapshot,
} from '@/lib/regime/feature-builder';
import type { OnChainAsset } from '@/types/onchain';
import type {
  RegimeCurrentResponse,
  RegimeLabel,
} from '@/types/regime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS: OnChainAsset[] = ['BTC', 'ETH'];
const CACHE_TTL = 3600;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

interface AssetResult {
  asset: OnChainAsset;
  regimeComputed: boolean;
  regimeChanged: boolean;
  committedRegime: RegimeLabel | null;
  confidence: number | null;
  skipped: boolean;
  error?: string;
}

async function refreshAsset(asset: OnChainAsset): Promise<AssetResult> {
  const result: AssetResult = {
    asset,
    regimeComputed: false,
    regimeChanged: false,
    committedRegime: null,
    confidence: null,
    skipped: false,
  };

  if (!quantEngine.configured) {
    result.skipped = true;
    return result;
  }

  try {
    const prevSnapshot = await prisma.regimeSnapshot.findFirst({
      where: { asset },
      orderBy: { timestamp: 'desc' },
    });

    const now = new Date();
    // Round to the hour for idempotent upsert
    now.setUTCMinutes(0, 0, 0);
    const timestamp = now.toISOString();

    const snapshot = await assembleCacheSnapshot(asset, timestamp);
    const featureVector = buildFeatureVectorFromSnapshot(snapshot);

    const classification = await quantEngine.classifyRegime({
      asset,
      feature_vector: featureVector,
      prev_regime: (prevSnapshot?.committedRegime as RegimeLabel | undefined) ?? null,
      prev_raw_classification:
        (prevSnapshot?.rawClassification as RegimeLabel | undefined) ?? null,
    });

    if (!classification) {
      result.error = 'Quant Engine returned null';
      return result;
    }

    await prisma.regimeSnapshot.upsert({
      where: { asset_timestamp: { asset, timestamp: now } },
      create: {
        asset,
        timestamp: now,
        rawClassification: classification.raw_classification,
        committedRegime: classification.committed_regime,
        regimeChanged: classification.regime_changed,
        prevRegime: (prevSnapshot?.committedRegime as RegimeLabel | undefined) ?? null,
        confidence: classification.confidence,
        featureVector: featureVector as unknown as object,
        featureSupport: classification.feature_support as unknown as object,
      },
      update: {
        rawClassification: classification.raw_classification,
        committedRegime: classification.committed_regime,
        regimeChanged: classification.regime_changed,
        confidence: classification.confidence,
        featureVector: featureVector as unknown as object,
        featureSupport: classification.feature_support as unknown as object,
      },
    });

    const overlay: RegimeCurrentResponse = {
      asset,
      classification,
      feature_vector: featureVector,
      days_in_regime: null, // recomputed on GET from the transition history
      computed_at: timestamp,
      staleness: 'fresh',
      quant_engine_configured: true,
    };
    await setCached(`regime:current:${asset}`, overlay, CACHE_TTL);

    result.regimeComputed = true;
    result.regimeChanged = classification.regime_changed;
    result.committedRegime = classification.committed_regime;
    result.confidence = classification.confidence;
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
  const assets: AssetResult[] = [];
  for (const asset of ASSETS) {
    assets.push(await refreshAsset(asset));
  }

  // Slice 2 will add: convergence snapshots + forward-returns daily branch.

  return NextResponse.json({
    ok: true,
    assets,
    quantEngineConfigured: quantEngine.configured,
    elapsedMs: Date.now() - startTs,
  });
}
