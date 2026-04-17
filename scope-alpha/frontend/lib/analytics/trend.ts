/**
 * Health score trend + momentum computation.
 *
 * Given an ordered series of HealthScoreSnapshot rows, compute:
 *   - change24h: difference between current score and the snapshot closest
 *     to 24h ago (linear interpolation when exact match is missing)
 *   - change7d: same idea over 7 days
 *   - sparkline24h: one point per hour for the last 24h (nulls filled via
 *     forward-carry so the client can render a continuous line)
 *   - componentSparklines: per-component sparklines for the same window
 *   - direction + momentum: via classifyTrend()
 */

import { classifyTrend, type ClassifiedTrend } from './regime';

export interface SnapshotLite {
  score: number;
  funding: number;
  oi: number;
  liquidation: number;
  basis: number;
  timestamp: Date;
}

export interface TrendResult extends ClassifiedTrend {
  change24h: number;
  change7d: number;
  sparkline24h: number[];
  componentSparklines: {
    funding: number[];
    oi: number[];
    liquidation: number[];
    basis: number[];
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Find the snapshot whose timestamp is closest to `target`. Returns null for
 * empty input. Linear scan — list is small (≤ 7d × 24h = 168 rows max).
 */
function closestTo(series: SnapshotLite[], target: number): SnapshotLite | null {
  if (series.length === 0) return null;
  let best = series[0];
  let bestDelta = Math.abs(best.timestamp.getTime() - target);
  for (let i = 1; i < series.length; i++) {
    const delta = Math.abs(series[i].timestamp.getTime() - target);
    if (delta < bestDelta) {
      best = series[i];
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Build an hourly sparkline for the last 24h. If a bucket has no snapshot,
 * carry the previous bucket's value forward. If there's no previous value,
 * use the provided `fallback`.
 */
function buildHourlySparkline(
  series: SnapshotLite[],
  now: number,
  picker: (s: SnapshotLite) => number,
  fallback: number,
): number[] {
  const out: number[] = new Array(24);
  // Pre-sort ascending by timestamp so we can walk forward.
  const sorted = [...series].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  let idx = 0;
  let lastValue = fallback;
  for (let h = 23; h >= 0; h--) {
    const bucketEnd = now - h * HOUR_MS;
    while (idx < sorted.length && sorted[idx].timestamp.getTime() <= bucketEnd) {
      lastValue = picker(sorted[idx]);
      idx++;
    }
    out[23 - h] = lastValue;
  }
  return out;
}

export function computeTrend(
  current: SnapshotLite,
  history: SnapshotLite[],
): TrendResult {
  const nowTs = current.timestamp.getTime();
  const target24h = nowTs - DAY_MS;
  const target7d = nowTs - 7 * DAY_MS;

  const at24h = closestTo(history, target24h);
  const at7d = closestTo(history, target7d);

  const change24h = at24h ? current.score - at24h.score : 0;
  const change7d = at7d ? current.score - at7d.score : 0;

  const classified = classifyTrend(change24h, change7d);

  // Include `current` in the sparkline source so the last bucket reflects it.
  const withCurrent = [...history, current];

  const sparkline24h = buildHourlySparkline(
    withCurrent,
    nowTs,
    (s) => s.score,
    current.score,
  );

  const componentSparklines = {
    funding: buildHourlySparkline(withCurrent, nowTs, (s) => s.funding, current.funding),
    oi: buildHourlySparkline(withCurrent, nowTs, (s) => s.oi, current.oi),
    liquidation: buildHourlySparkline(withCurrent, nowTs, (s) => s.liquidation, current.liquidation),
    basis: buildHourlySparkline(withCurrent, nowTs, (s) => s.basis, current.basis),
  };

  return {
    ...classified,
    change24h,
    change7d,
    sparkline24h,
    componentSparklines,
  };
}
