/**
 * PUT /api/portfolio/[id]
 *
 * Update execution metadata on an active tracked position. Only the owner
 * can update, and only while status='active'.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('portfolio/track', request, session.user.id);
  if (limited) return limited;

  try {

  const tracked = await prisma.trackedSignal.findUnique({
    where: { id: params.id },
    select: { id: true, subscriberId: true, status: true },
  });
  if (!tracked) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (tracked.subscriberId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (tracked.status !== 'active') {
    return NextResponse.json(
      { error: 'Cannot update a closed position' },
      { status: 400 },
    );
  }

  let body: {
    personalEntry?: number | null;
    personalStop?: number | null;
    positionSize?: number | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Prisma.TrackedSignalUpdateInput = {};
  if ('personalEntry' in body) {
    data.personalEntry =
      body.personalEntry == null ? null : new Prisma.Decimal(body.personalEntry);
  }
  if ('personalStop' in body) {
    data.personalStop =
      body.personalStop == null ? null : new Prisma.Decimal(body.personalStop);
  }
  if ('positionSize' in body) {
    data.positionSize =
      body.positionSize == null ? null : new Prisma.Decimal(body.positionSize);
  }
  if ('notes' in body) {
    data.notes = body.notes ? sanitizeText(body.notes) : null;
  }

  const updated = await prisma.trackedSignal.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ id: updated.id, ok: true });
  } catch (error) {
    captureRouteError(error, { route: '/api/portfolio/[id] PUT', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}
