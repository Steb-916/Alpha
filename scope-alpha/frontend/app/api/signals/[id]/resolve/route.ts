/**
 * POST /api/signals/[id]/resolve
 *
 * Manually resolve a signal — sets resolvedAt, resolvedPrice, computes the
 * total P&L (multi-target weighted) and updates AnalystPerformance aggregate
 * fields including drawdown.
 *
 * Body:
 *   {
 *     targetHits?: [{ targetId, hitAt: ISO, hitPrice }],
 *     finalClosePrice: number,           // close for remaining position
 *     notes?: string                     // optional appended notes
 *   }
 *
 * For legacy single-target signals (no SignalTarget rows), `targetHits` is
 * ignored and the entire position is treated as closing at finalClosePrice.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  calculateLegacySinglePnL,
  calculateMultiTargetPnL,
  type ResolvedTarget,
} from '@/lib/signals/validation';
import { serializeSignal } from '@/lib/signals/serializer';
import { recomputeAnalystPerformance } from '@/lib/analytics/performance-aggregator';
import { checkAndCreateMilestones, createFeedEvent } from '@/lib/feed/events';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeRichText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

interface TargetHitInput {
  targetId: string;
  hitAt: string;
  hitPrice: number;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('signals/resolve', request, session.user.id);
  if (limited) return limited;

  try {

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    include: { targets: { orderBy: { order: 'asc' } } },
  });

  if (!signal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (signal.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (signal.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot resolve signal in status '${signal.status}'` },
      { status: 400 },
    );
  }

  let body: {
    targetHits?: TargetHitInput[];
    finalClosePrice?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.finalClosePrice !== 'number' || body.finalClosePrice <= 0) {
    return NextResponse.json(
      { error: 'finalClosePrice must be a positive number' },
      { status: 400 },
    );
  }

  const direction = signal.direction as 'long' | 'short';
  const entryPrice = Number(signal.entryPrice);
  const finalClosePrice = body.finalClosePrice;

  // Compute P&L. Multi-target path if real SignalTarget rows exist; legacy
  // single-target otherwise.
  let pnlPercent: number;
  const hitTargets: ResolvedTarget[] = [];
  if (signal.targets.length > 0 && Array.isArray(body.targetHits)) {
    // Validate every targetHit references a real target on this signal.
    for (const hit of body.targetHits) {
      const t = signal.targets.find((x) => x.id === hit.targetId);
      if (!t) {
        return NextResponse.json(
          { error: `targetId ${hit.targetId} does not belong to this signal` },
          { status: 400 },
        );
      }
      if (typeof hit.hitPrice !== 'number' || hit.hitPrice <= 0) {
        return NextResponse.json(
          { error: 'hitPrice must be a positive number' },
          { status: 400 },
        );
      }
      hitTargets.push({
        closePercent: t.closePercent,
        hitPrice: hit.hitPrice,
      });
    }
    // Sum check: total closePercent of hit targets must not exceed 100.
    const sum = hitTargets.reduce((s, t) => s + t.closePercent, 0);
    if (sum > 100.01) {
      return NextResponse.json(
        { error: `Hit targets close more than 100% of position (${sum.toFixed(2)})` },
        { status: 400 },
      );
    }
    pnlPercent = calculateMultiTargetPnL(
      hitTargets,
      finalClosePrice,
      direction,
      entryPrice,
    );
  } else {
    // Legacy single-target — entire position closes at finalClosePrice.
    pnlPercent = calculateLegacySinglePnL(finalClosePrice, direction, entryPrice);
  }

  // Update signal + target rows + recompute performance, all in a transaction.
  const targetUpdates: Prisma.PrismaPromise<unknown>[] = [];
  if (body.targetHits && body.targetHits.length > 0) {
    for (const hit of body.targetHits) {
      targetUpdates.push(
        prisma.signalTarget.update({
          where: { id: hit.targetId },
          data: {
            hitAt: new Date(hit.hitAt),
            hitPrice: new Prisma.Decimal(hit.hitPrice),
          },
        }),
      );
    }
  }

  await prisma.$transaction([
    ...targetUpdates,
    prisma.signal.update({
      where: { id: signal.id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedPrice: new Prisma.Decimal(finalClosePrice),
        resultPnlPercent: new Prisma.Decimal(pnlPercent),
        notes: body.notes ? sanitizeRichText(body.notes) : signal.notes,
      },
    }),
  ]);

  // Recompute aggregate stats (incl. drawdown). This is cheap because each
  // analyst has at most a few hundred signals.
  await recomputeAnalystPerformance(signal.analystId).catch((err) =>
    console.error('[resolve] recomputeAnalystPerformance failed:', err),
  );

  // Phase 6: emit a public feed event for the resolved signal, then check
  // whether the analyst just hit a milestone (signals/subscribers/winstreak).
  // Both are fire-and-forget — never block the resolve response.
  createFeedEvent({
    type: 'signal_resolved',
    actorId: signal.analystId,
    analystId: signal.analystId,
    signalId: signal.id,
    metadata: {
      asset: signal.assetSymbol,
      direction: signal.direction,
      resultPnl: pnlPercent,
    },
    visibility: 'public',
  }).catch((err) => console.error('[resolve] feed event failed:', err));

  checkAndCreateMilestones(signal.analystId).catch((err) =>
    console.error('[resolve] milestone check failed:', err),
  );

  const updated = await prisma.signal.findUnique({
    where: { id: signal.id },
    include: { targets: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json(serializeSignal(updated!));
  } catch (error) {
    captureRouteError(error, { route: '/api/signals/[id]/resolve', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to resolve signal' }, { status: 500 });
  }
}
