/**
 * POST /api/portfolio/track
 *
 * Subscriber tracks a signal. Validates:
 *   - Signal exists and is currently active
 *   - Subscriber has access via checkSubscriptionAccess (Phase 4 stub)
 *   - Subscriber hasn't already tracked this signal (unique constraint)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkSubscriptionAccess } from '@/lib/subscriptions';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('portfolio/track', request, session.user.id);
  if (limited) return limited;

  let body: {
    signalId?: string;
    personalEntry?: number;
    personalStop?: number;
    positionSize?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.signalId || typeof body.signalId !== 'string') {
    return NextResponse.json({ error: 'signalId is required' }, { status: 400 });
  }

  const signal = await prisma.signal.findUnique({
    where: { id: body.signalId },
    select: { id: true, analystId: true, status: true },
  });
  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }
  if (signal.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot track signal in status '${signal.status}'` },
      { status: 400 },
    );
  }

  // Self-tracking is allowed (an analyst can track their own signal for fun)
  // but the access check still works because checkSubscriptionAccess
  // short-circuits to active when subscriber === analyst.
  const access = await checkSubscriptionAccess(session.user.id, signal.analystId);
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: 'Subscription required to track this analyst', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 403 },
    );
  }

  try {
    const tracked = await prisma.trackedSignal.create({
      data: {
        subscriberId: session.user.id,
        signalId: signal.id,
        analystId: signal.analystId,
        personalEntry:
          typeof body.personalEntry === 'number'
            ? new Prisma.Decimal(body.personalEntry)
            : null,
        personalStop:
          typeof body.personalStop === 'number'
            ? new Prisma.Decimal(body.personalStop)
            : null,
        positionSize:
          typeof body.positionSize === 'number'
            ? new Prisma.Decimal(body.positionSize)
            : null,
        notes: body.notes ? sanitizeText(body.notes) : null,
      },
    });
    return NextResponse.json({ id: tracked.id, ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Signal already tracked', code: 'ALREADY_TRACKED' },
        { status: 409 },
      );
    }
    captureRouteError(err, { route: '/api/portfolio/track', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to track signal' }, { status: 500 });
  }
}
