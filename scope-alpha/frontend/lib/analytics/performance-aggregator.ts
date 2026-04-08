/**
 * Recomputes the AnalystPerformance row for a given analyst from their
 * resolved signals. Called after every signal resolution.
 *
 * Cheap (a few hundred signals max per analyst) — no need to make this
 * incremental. Future optimization could use partial updates if analysts
 * grow into the thousands of signals range.
 */

import { prisma } from '@/lib/prisma';
import {
  winRate,
  profitFactor,
  avgPnl,
  totalPnl,
  bestStreak,
  worstStreak,
  isWin,
  isLoss,
} from '@/lib/analytics/metrics';
import { calculateDrawdown } from '@/lib/analytics/drawdown';

export async function recomputeAnalystPerformance(analystId: string): Promise<void> {
  const allSignals = await prisma.signal.findMany({
    where: { analystId, status: { in: ['active', 'resolved', 'cancelled'] } },
    select: {
      id: true,
      status: true,
      resultPnlPercent: true,
      resolvedAt: true,
      publishedAt: true,
    },
    orderBy: { publishedAt: 'asc' },
  });

  // Convert Decimal to number for the metrics module.
  const normalized = allSignals.map((s) => ({
    id: s.id,
    status: s.status,
    resultPnlPercent: s.resultPnlPercent != null ? Number(s.resultPnlPercent) : null,
    resolvedAt: s.resolvedAt,
    publishedAt: s.publishedAt,
  }));

  const resolved = normalized.filter((s) => s.resultPnlPercent != null);

  const totalSignals = normalized.length;
  const wins = resolved.filter(isWin).length;
  const losses = resolved.filter(isLoss).length;
  const wr = winRate(resolved);
  const ap = avgPnl(resolved);
  const tp = totalPnl(resolved);
  const pf = profitFactor(resolved);
  const bs = bestStreak(resolved);
  const ws = worstStreak(resolved);

  // 90-day rolling
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const last90 = resolved.filter(
    (s) => s.resolvedAt && s.resolvedAt >= ninetyDaysAgo,
  );
  const last90Pnl = totalPnl(last90);
  const last90Wr = winRate(last90);

  const drawdown = calculateDrawdown(resolved);

  await prisma.analystPerformance.upsert({
    where: { analystId },
    create: {
      analystId,
      totalSignals,
      winCount: wins,
      lossCount: losses,
      winRate: wr,
      avgPnlPercent: ap,
      profitFactor: pf,
      bestStreak: bs,
      worstStreak: ws,
      totalPnlPercent: tp,
      last90dPnlPercent: last90Pnl,
      last90dWinRate: last90Wr,
      maxDrawdownPct: drawdown.maxDrawdownPct,
      currentDrawdownPct: drawdown.currentDrawdownPct,
      maxDrawdownDate: drawdown.maxDrawdownEndDate,
      updatedAt: new Date(),
    },
    update: {
      totalSignals,
      winCount: wins,
      lossCount: losses,
      winRate: wr,
      avgPnlPercent: ap,
      profitFactor: pf,
      bestStreak: bs,
      worstStreak: ws,
      totalPnlPercent: tp,
      last90dPnlPercent: last90Pnl,
      last90dWinRate: last90Wr,
      maxDrawdownPct: drawdown.maxDrawdownPct,
      currentDrawdownPct: drawdown.currentDrawdownPct,
      maxDrawdownDate: drawdown.maxDrawdownEndDate,
      updatedAt: new Date(),
    },
  });
}
