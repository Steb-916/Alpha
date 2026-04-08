/**
 * Pure analytics helpers shared between the legacy mock-data path
 * (`lib/performanceCalc.ts`) and the new DB-backed analytics routes.
 *
 * Inputs are normalised "signal-like" objects with at least:
 *   { resultPnlPercent: number | null, status: string, resolvedAt: Date | null }
 *
 * No Prisma, no React. Pure functions only.
 */

export interface SignalLike {
  resultPnlPercent: number | null;
  status?: string;
  resolvedAt?: Date | string | null;
  publishedAt?: Date | string | null;
  assetSymbol?: string;
  direction?: string;
  timeframe?: string;
}

// ─── Win/loss predicates ────────────────────────────────────────────────────

export function isResolved(s: SignalLike): boolean {
  return s.resultPnlPercent != null;
}

export function isWin(s: SignalLike): boolean {
  return s.resultPnlPercent != null && s.resultPnlPercent > 0;
}

export function isLoss(s: SignalLike): boolean {
  return s.resultPnlPercent != null && s.resultPnlPercent < 0;
}

export function isBreakeven(s: SignalLike): boolean {
  return s.resultPnlPercent === 0;
}

// ─── Aggregate metrics ──────────────────────────────────────────────────────

export function winRate(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length === 0) return 0;
  const wins = resolved.filter(isWin).length;
  return Math.round((wins / resolved.length) * 100 * 100) / 100;
}

export function avgPnl(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length === 0) return 0;
  const sum = resolved.reduce((s, x) => s + (x.resultPnlPercent ?? 0), 0);
  return Math.round((sum / resolved.length) * 10000) / 10000;
}

export function totalPnl(signals: SignalLike[]): number {
  const sum = signals
    .filter(isResolved)
    .reduce((s, x) => s + (x.resultPnlPercent ?? 0), 0);
  return Math.round(sum * 10000) / 10000;
}

export function profitFactor(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length === 0) return 0;
  let grossWin = 0;
  let grossLoss = 0;
  for (const s of resolved) {
    const v = s.resultPnlPercent ?? 0;
    if (v > 0) grossWin += v;
    else if (v < 0) grossLoss += Math.abs(v);
  }
  if (grossLoss === 0) return grossWin > 0 ? 999 : 0;
  return Math.round((grossWin / grossLoss) * 10000) / 10000;
}

export function bestTrade(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length === 0) return 0;
  return Math.max(...resolved.map((s) => s.resultPnlPercent ?? 0));
}

export function worstTrade(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length === 0) return 0;
  return Math.min(...resolved.map((s) => s.resultPnlPercent ?? 0));
}

// ─── Streaks ────────────────────────────────────────────────────────────────

export function bestStreak(signals: SignalLike[]): number {
  const resolved = sortByResolvedAt(signals.filter(isResolved));
  let best = 0;
  let cur = 0;
  for (const s of resolved) {
    if (isWin(s)) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

export function worstStreak(signals: SignalLike[]): number {
  const resolved = sortByResolvedAt(signals.filter(isResolved));
  let worst = 0;
  let cur = 0;
  for (const s of resolved) {
    if (isLoss(s)) {
      cur += 1;
      if (cur > worst) worst = cur;
    } else {
      cur = 0;
    }
  }
  return worst;
}

// ─── Cumulative P&L ─────────────────────────────────────────────────────────

export interface CumulativePoint {
  date: string; // ISO
  cumulative: number;
}

export function cumulativePnl(signals: SignalLike[]): CumulativePoint[] {
  const resolved = sortByResolvedAt(signals.filter(isResolved));
  const out: CumulativePoint[] = [];
  let running = 0;
  for (const s of resolved) {
    running += s.resultPnlPercent ?? 0;
    out.push({
      date:
        s.resolvedAt instanceof Date
          ? s.resolvedAt.toISOString()
          : new Date(s.resolvedAt as string).toISOString(),
      cumulative: Math.round(running * 10000) / 10000,
    });
  }
  return out;
}

// ─── Sharpe approximation ───────────────────────────────────────────────────

/**
 * Naive Sharpe-like ratio: mean(pnl) / stddev(pnl). Not annualised, no
 * risk-free rate. Useful as a relative comparison metric only.
 */
export function sharpeApprox(signals: SignalLike[]): number {
  const resolved = signals.filter(isResolved);
  if (resolved.length < 2) return 0;
  const pnls = resolved.map((s) => s.resultPnlPercent ?? 0);
  const mean = pnls.reduce((s, x) => s + x, 0) / pnls.length;
  const variance = pnls.reduce((s, x) => s + (x - mean) ** 2, 0) / (pnls.length - 1);
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return Math.round((mean / stddev) * 10000) / 10000;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sortByResolvedAt(signals: SignalLike[]): SignalLike[] {
  return [...signals].sort((a, b) => {
    const at = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
    const bt = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
    return at - bt;
  });
}
