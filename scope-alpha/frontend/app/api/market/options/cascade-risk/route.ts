/**
 * GET /api/market/options/cascade-risk?asset=BTC
 *
 * Cascade Risk Overlay — combines dealer negative-gamma zones (from cached
 * GEX) with the liquidation heatmap to flag prices where dealer hedging
 * would amplify moves into dense liquidation clusters.
 *
 * Inputs are both cache-only:
 *   - options:gex:{asset}        — populated by the options cron / fetcher
 *   - market:liq-heatmap:{asset} — populated by /api/market/liquidation-heatmap
 *
 * If either input is absent, returns 503 rather than fabricating data. The
 * view falls back to an UnavailableBanner in that case.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import type { HeatmapResult } from '@/lib/analytics/liquidation-heatmap';
import type {
  CascadeRiskLevel,
  CascadeRiskOverlay,
  CascadeRiskSummary,
  CascadeRiskZone,
  CascadeStaleness,
  GEXOutput,
} from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Configuration ──────────────────────────────────────────────────────────
//
// Thresholds are heuristic, uncalibrated, and named so they're tunable in one
// place. Revisit once we have labeled cascade events to backtest against.

const ALLOWED = new Set(['BTC', 'ETH']);

/** Flag strikes whose |netGex| sits in the top (1 - TOP_GEX_ABS_PERCENTILE) slice. */
const TOP_GEX_ABS_PERCENTILE = 0.8;

/** Liq-intensity threshold for "critical" cascade risk (with negative gamma). */
const CRITICAL_LIQ_INTENSITY = 0.8;

/** Liq-intensity threshold for "elevated" cascade risk (with negative gamma). */
const ELEVATED_LIQ_INTENSITY = 0.6;

/** Either negative gamma alone or liq intensity above this triggers "moderate". */
const MODERATE_LIQ_INTENSITY = 0.5;

/** TTL matches the heatmap's TTL — no point being fresher than our freshest input. */
const CACHE_TTL_SECONDS = 60;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Standard lower_bound: smallest index i where arr[i] >= target, or arr.length.
 * arr MUST be sorted ascending.
 */
function lowerBound(arr: number[], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function nearestHeatmapLevel(
  sortedPrices: number[],
  heatmap: HeatmapResult,
  target: number,
): { intensity: number; side: 'long' | 'short' } {
  if (sortedPrices.length === 0) return { intensity: 0, side: 'long' };
  const i = lowerBound(sortedPrices, target);
  let best = i;
  if (i === sortedPrices.length) best = i - 1;
  else if (i > 0) {
    const distLeft = target - sortedPrices[i - 1];
    const distRight = sortedPrices[i] - target;
    if (distLeft < distRight) best = i - 1;
  }
  const level = heatmap.levels.find((l) => l.price === sortedPrices[best]);
  return level
    ? { intensity: level.intensity, side: level.side }
    : { intensity: 0, side: 'long' };
}

function classifyZone(netGex: number, intensity: number): CascadeRiskLevel {
  const negativeGamma = netGex < 0;
  if (negativeGamma && intensity >= CRITICAL_LIQ_INTENSITY) return 'critical';
  if (negativeGamma && intensity >= ELEVATED_LIQ_INTENSITY) return 'elevated';
  if (negativeGamma || intensity >= MODERATE_LIQ_INTENSITY) return 'moderate';
  return 'low';
}

function overallFromZones(zones: CascadeRiskZone[]): CascadeRiskLevel {
  if (zones.some((z) => z.cascadeRisk === 'critical')) return 'critical';
  if (zones.some((z) => z.cascadeRisk === 'elevated')) return 'elevated';
  if (zones.some((z) => z.cascadeRisk === 'moderate')) return 'moderate';
  return 'low';
}

/** Fetch from fresh cache first, then stale. Report which one we got. */
async function readWithStaleness<T>(
  key: string,
): Promise<{ value: T | null; staleness: CascadeStaleness }> {
  const fresh = await getCached<T>(key);
  if (fresh != null) return { value: fresh, staleness: 'fresh' };
  const stale = await getStale<T>(key);
  if (stale != null) return { value: stale, staleness: 'stale' };
  return { value: null, staleness: 'fresh' };
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Cascade risk only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const overlayKey = `options:cascade-risk:${asset}`;
  const cached = await getCached<CascadeRiskOverlay>(overlayKey);
  if (cached) return NextResponse.json(cached);

  const [gexRead, heatmapRead] = await Promise.all([
    readWithStaleness<GEXOutput>(`options:gex:${asset}`),
    readWithStaleness<HeatmapResult>(`market:liq-heatmap:${asset}`),
  ]);

  if (!gexRead.value || !heatmapRead.value) {
    return NextResponse.json(
      {
        error:
          'Cascade risk unavailable — GEX or liquidation heatmap not yet cached',
        asset,
        quantEngineConfigured: true,
      },
      { status: 503 },
    );
  }

  const gex = gexRead.value;
  const heatmap = heatmapRead.value;
  const staleness: CascadeStaleness =
    gexRead.staleness === 'stale' || heatmapRead.staleness === 'stale'
      ? 'stale'
      : 'fresh';

  const spot = gex.spot_price;
  if (!Number.isFinite(spot) || spot <= 0) {
    return NextResponse.json(
      { error: 'GEX cache present but spot_price is invalid', asset },
      { status: 503 },
    );
  }

  const sortedPrices = heatmap.levels
    .map((l) => l.price)
    .sort((a, b) => a - b);

  const absGex = gex.levels.map((l) => Math.abs(l.gex_usd)).sort((a, b) => a - b);
  const cutoffIdx = Math.floor(absGex.length * TOP_GEX_ABS_PERCENTILE);
  const gexThreshold = absGex[cutoffIdx] ?? 0;

  // First pass: negative-gamma zones only. Positive-gamma pin zones
  // (call-wall co-located with liq clusters) are a known future extension.
  const zones: CascadeRiskZone[] = gex.levels
    .filter((l) => l.gex_usd < 0 && Math.abs(l.gex_usd) >= gexThreshold)
    .map((l) => {
      const liq = nearestHeatmapLevel(sortedPrices, heatmap, l.strike);
      return {
        priceLevel: l.strike,
        gexContribution: l.gex_usd,
        liqIntensity: liq.intensity,
        liqSide: liq.side,
        cascadeRisk: classifyZone(l.gex_usd, liq.intensity),
        distanceFromSpotPct: ((l.strike - spot) / spot) * 100,
      };
    })
    .sort((a, b) => b.liqIntensity - a.liqIntensity);

  const overallRisk = overallFromZones(zones);

  const summary: CascadeRiskSummary = {
    criticalCount: zones.filter((z) => z.cascadeRisk === 'critical').length,
    elevatedCount: zones.filter((z) => z.cascadeRisk === 'elevated').length,
    moderateCount: zones.filter((z) => z.cascadeRisk === 'moderate').length,
    lowCount: zones.filter((z) => z.cascadeRisk === 'low').length,
    topZonePrice: zones[0]?.priceLevel ?? null,
    topZoneDistancePct: zones[0]?.distanceFromSpotPct ?? null,
  };

  const overlay: CascadeRiskOverlay = {
    asset,
    computedAt: new Date().toISOString(),
    spot,
    gammaFlip: Number.isFinite(gex.gamma_flip) ? gex.gamma_flip : null,
    zones,
    overallRisk,
    summary,
    staleness,
  };

  await setCached(overlayKey, overlay, CACHE_TTL_SECONDS);
  return NextResponse.json(overlay);
}
