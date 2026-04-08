/**
 * POST /api/signals/[id]/publish
 *
 * Transitions a draft signal to active. Sets `publishedAt = now`,
 * `status = 'active'`, then fires (fire-and-forget) the notification
 * dispatcher stub. The dispatcher is currently a Phase 3 stub that just
 * logs — when Phase 3 lands, this route will start sending real
 * in-app/email/Telegram notifications without code changes here.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dispatchNotification } from '@/lib/notifications/dispatcher';
import { serializeSignal } from '@/lib/signals/serializer';
import { createFeedEvent } from '@/lib/feed/events';
import { ensureRateLimit } from '@/lib/rateLimit';
import { captureRouteError } from '@/lib/sentry';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('signals/create', request, session.user.id);
  if (limited) return limited;

  // Phase 7: gate publishing on the analyst publishing agreement.
  const userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { analystAgreementAcceptedAt: true },
  });
  if (!userRow?.analystAgreementAcceptedAt) {
    return NextResponse.json(
      { error: 'Publishing agreement not accepted', code: 'AGREEMENT_REQUIRED' },
      { status: 403 },
    );
  }

  try {
  const existing = await prisma.signal.findUnique({
    where: { id: params.id },
    include: { analyst: { select: { id: true, displayName: true, slug: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: `Cannot publish signal in status '${existing.status}'` },
      { status: 400 },
    );
  }

  const updated = await prisma.signal.update({
    where: { id: existing.id },
    data: {
      status: 'active',
      publishedAt: new Date(),
    },
    include: { targets: { orderBy: { order: 'asc' } } },
  });

  // Find recipients for the notification dispatch (active subscribers).
  // We do this AFTER the publish update so a partial failure leaves the
  // signal correctly published.
  const subscribers = await prisma.subscription.findMany({
    where: { analystId: existing.analystId, status: 'active' },
    select: { subscriberId: true },
  });
  const recipientIds = subscribers.map((s) => s.subscriberId);

  if (recipientIds.length > 0) {
    // Fire-and-forget. Phase 3 stub will log; future real impl will dispatch.
    dispatchNotification({
      type: 'new_signal',
      recipientIds,
      title: `${existing.analyst.displayName ?? 'Analyst'}: New ${updated.direction.toUpperCase()} on ${updated.assetSymbol}`,
      body: `${updated.conviction} conviction ${updated.direction} on ${updated.assetSymbol} (${updated.timeframe})`,
      metadata: {
        signalId: updated.id,
        analystId: updated.analystId,
        analystSlug: existing.analyst.slug,
        asset: updated.assetSymbol,
        direction: updated.direction,
        conviction: updated.conviction,
        timeframe: updated.timeframe,
      },
    }).catch((err) => console.error('[publish] dispatch failed:', err));
  }

  // Phase 6: emit a feed event so subscribers see the new signal in /feed.
  createFeedEvent({
    type: 'signal_published',
    actorId: updated.analystId,
    analystId: updated.analystId,
    signalId: updated.id,
    metadata: {
      asset: updated.assetSymbol,
      direction: updated.direction,
      conviction: updated.conviction,
      timeframe: updated.timeframe,
      analystSlug: existing.analyst.slug,
      analystName: existing.analyst.displayName,
    },
    visibility: 'subscribers',
  }).catch((err) => console.error('[publish] feed event failed:', err));

  return NextResponse.json(serializeSignal(updated));
  } catch (error) {
    captureRouteError(error, { route: '/api/signals/[id]/publish', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to publish signal' }, { status: 500 });
  }
}
