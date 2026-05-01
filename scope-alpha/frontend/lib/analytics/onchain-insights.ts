/**
 * Cross-domain divergence detection for on-chain analytics.
 * Combines on-chain signals with derivatives signals to surface
 * actionable insights as cards in the UI.
 */

import type { OnChainOverview, ExchangeFlowData, InsightCard } from '@/lib/onchain/types';
import type { FundingData } from '@/lib/types';

interface InsightInput {
  asset: string;
  onchain: OnChainOverview | null;
  exchangeFlows: ExchangeFlowData | null;
  funding: FundingData | null;
  priceChange24h?: number | null;
}

function recentNetFlow(flows: ExchangeFlowData | null, days = 3): number | null {
  if (!flows || flows.points.length === 0) return null;
  const recent = flows.points.slice(-days);
  return recent.reduce((s, p) => s + p.netFlowNative, 0);
}

function inflowTrend(flows: ExchangeFlowData | null): 'rising' | 'falling' | 'stable' {
  if (!flows || flows.points.length < 7) return 'stable';
  const pts = flows.points.slice(-7);
  const firstHalf = pts.slice(0, 3).reduce((s, p) => s + p.inflowNative, 0) / 3;
  const lastHalf = pts.slice(-3).reduce((s, p) => s + p.inflowNative, 0) / 3;
  const pct = firstHalf > 0 ? (lastHalf - firstHalf) / firstHalf : 0;
  if (pct > 0.1) return 'rising';
  if (pct < -0.1) return 'falling';
  return 'stable';
}

export function generateInsights(input: InsightInput): InsightCard[] {
  const { asset, onchain, exchangeFlows, funding, priceChange24h } = input;
  const cards: InsightCard[] = [];
  const now = new Date().toISOString();

  const netFlow3d = recentNetFlow(exchangeFlows, 3);
  const trend = inflowTrend(exchangeFlows);
  const mvrv = onchain?.mvrvZScore ?? null;
  const sopr = onchain?.sopr ?? null;
  const fundingZ = funding?.zScore ?? null;

  // ─── Distribution Signal ─────────────────────────────────────────────────
  // Price rising + exchange inflows spiking + SOPR > 1 = distribution under surface
  if (
    priceChange24h !== null &&
    priceChange24h !== undefined &&
    priceChange24h > 2 &&
    trend === 'rising' &&
    sopr !== null &&
    sopr > 1.02
  ) {
    const severity = sopr > 1.05 && priceChange24h > 4 ? 'high' : 'medium';
    cards.push({
      id: `distribution-${asset}-${Date.now()}`,
      type: 'distribution',
      severity,
      title: 'Distribution Under Surface',
      description:
        `${asset} price is rising +${priceChange24h.toFixed(1)}% while exchange inflows are increasing and SOPR=${sopr.toFixed(3)} indicates coins moving in profit. Long-term holders may be distributing into strength.`,
      signals: [
        `Price +${priceChange24h.toFixed(1)}% (24h)`,
        `Exchange inflows trending up`,
        `SOPR ${sopr.toFixed(3)} > 1.02 (sellers in profit)`,
      ],
      asset,
      timestamp: now,
    });
  }

  // ─── Accumulation Signal ─────────────────────────────────────────────────
  // Price falling + exchange outflows + MVRV < 1 = accumulation under capitulation
  if (
    priceChange24h !== null &&
    priceChange24h !== undefined &&
    priceChange24h < -2 &&
    netFlow3d !== null &&
    netFlow3d < 0 &&
    mvrv !== null &&
    mvrv < 0
  ) {
    const severity = mvrv < -0.5 && priceChange24h < -5 ? 'high' : 'medium';
    cards.push({
      id: `accumulation-${asset}-${Date.now()}`,
      type: 'accumulation',
      severity,
      title: 'Accumulation Under Capitulation',
      description:
        `${asset} is falling ${priceChange24h.toFixed(1)}% but on-chain outflows (coins leaving exchanges) and MVRV Z-Score=${mvrv.toFixed(2)} suggest smart money is accumulating at historically undervalued levels.`,
      signals: [
        `Price ${priceChange24h.toFixed(1)}% (24h)`,
        `Net exchange outflow (last 3d)`,
        `MVRV Z-Score ${mvrv.toFixed(2)} < 0 (historically undervalued)`,
      ],
      asset,
      timestamp: now,
    });
  }

  // ─── Squeeze Risk Signal ─────────────────────────────────────────────────
  // Funding extremely positive + exchange inflows rising = leveraged longs exposed
  if (
    fundingZ !== null &&
    fundingZ > 2 &&
    trend === 'rising'
  ) {
    const severity = fundingZ > 3 ? 'high' : 'medium';
    cards.push({
      id: `squeeze-${asset}-${Date.now()}`,
      type: 'squeeze_risk',
      severity,
      title: 'Long Squeeze Risk',
      description:
        `${asset} funding rate is ${fundingZ.toFixed(1)} standard deviations above normal while exchange inflows are rising — whales may be selling into over-leveraged longs. Elevated squeeze risk.`,
      signals: [
        `Funding Z-Score ${fundingZ.toFixed(1)}σ (extreme long bias)`,
        `Exchange inflows trending up`,
        `Potential whale distribution into retail longs`,
      ],
      asset,
      timestamp: now,
    });
  }

  return cards;
}
