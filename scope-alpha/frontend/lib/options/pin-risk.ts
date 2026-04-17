/**
 * Pin risk assessment — how likely is price to pin at max pain as expiry
 * approaches? Heuristic scoring layered on top of the Phase 3 max-pain
 * computation.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';
import type { PinRiskOutput } from '@/types/options';
import { computeMaxPain } from './max-pain';

export interface PinRiskInput {
  asset: string;
  chain: OptionsChainEntry[];
  expirationDate: Date;
}

export function computePinRisk(input: PinRiskInput): PinRiskOutput | null {
  const { asset, chain, expirationDate } = input;
  const ts = expirationDate.getTime();
  const atExpiry = chain.filter((c) => c.expirationDate.getTime() === ts);
  if (atExpiry.length === 0) return null;

  const spotPrice = atExpiry[0].underlyingPrice;
  const maxPain = computeMaxPain(chain, expirationDate);
  if (maxPain == null || !Number.isFinite(spotPrice) || spotPrice <= 0) {
    return null;
  }

  const daysToExpiry = atExpiry[0].daysToExpiry;
  const distancePct = ((spotPrice - maxPain) / spotPrice) * 100;
  const nearMaxPain = Math.abs(spotPrice - maxPain) / spotPrice < 0.02;

  const oiAtMaxPain = atExpiry
    .filter((o) => o.strike === maxPain)
    .reduce((s, o) => s + o.openInterest, 0);
  const totalOI = atExpiry.reduce((s, o) => s + o.openInterest, 0);
  const oiConcentration = totalOI > 0 ? oiAtMaxPain / totalOI : 0;

  let pinProbability = 0;
  if (daysToExpiry <= 1) pinProbability += 0.3;
  else if (daysToExpiry <= 3) pinProbability += 0.15;
  if (nearMaxPain) pinProbability += 0.25;
  if (oiConcentration > 0.1) pinProbability += 0.2;
  pinProbability = Math.min(pinProbability, 0.95);

  let riskLevel: PinRiskOutput['risk_level'];
  if (pinProbability > 0.4) riskLevel = 'high';
  else if (pinProbability > 0.2) riskLevel = 'moderate';
  else riskLevel = 'low';

  const maxPainLabel = maxPain.toLocaleString();
  const distanceLabel = Math.abs(spotPrice - maxPain).toLocaleString(
    undefined,
    { maximumFractionDigits: 0 },
  );
  const daysLabel =
    daysToExpiry < 1
      ? `${Math.max(0, Math.round(daysToExpiry * 24))}h`
      : `${Math.round(daysToExpiry)}d`;

  const assessment =
    riskLevel === 'high'
      ? `High pin risk — price within $${distanceLabel} of max pain ($${maxPainLabel}) with ${daysLabel} to expiry.`
      : riskLevel === 'moderate'
      ? `Moderate pin risk — max pain at $${maxPainLabel}, ${daysLabel} to expiry.`
      : `Low pin risk — max pain at $${maxPainLabel}, ${daysLabel} to expiry, spot $${distanceLabel} away.`;

  return {
    asset,
    expiry_date: expirationDate.toISOString(),
    days_to_expiry: daysToExpiry,
    spot_price: spotPrice,
    max_pain_strike: maxPain,
    current_distance_pct: distancePct,
    pin_probability: pinProbability,
    oi_concentration: oiConcentration,
    risk_level: riskLevel,
    assessment,
    computed_at: new Date().toISOString(),
  };
}
