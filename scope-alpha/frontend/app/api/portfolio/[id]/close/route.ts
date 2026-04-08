/**
 * POST /api/portfolio/[id]/close
 *
 * Close a tracked position. Computes personalPnl using the simple
 * single-target formula from lib/signals/validation.ts.
 *
 * Only the owner can close, and only while status='active'.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateLegacySinglePnL } from '@/lib/signals/validation';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeText } from '@/lib/sanitize';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('portfolio/close', request, session.user.id);
  if (limited) return limited;

  const tracked = await prisma.trackedSignal.findUnique({
    where: { id: params.id },
    include: {
      signal: {
        select: {
          direction: true,
          entryPrice: true,
        },
      },
    },
  });
  if (!tracked) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (tracked.subscriberId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (tracked.status !== 'active') {
    return NextResponse.json({ error: 'Position is already closed' }, { status: 400 });
  }

  let body: { closePrice?: number; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.closePrice !== 'number' || body.closePrice <= 0) {
    return NextResponse.json(
      { error: 'closePrice must be a positive number' },
      { status: 400 },
    );
  }

  // Use the subscriber's personal entry if set; otherwise the analyst's entry.
  const entryPrice =
    tracked.personalEntry != null
      ? Number(tracked.personalEntry)
      : Number(tracked.signal.entryPrice);

  const direction = tracked.signal.direction as 'long' | 'short';
  const personalPnl = calculateLegacySinglePnL(body.closePrice, direction, entryPrice);

  const updated = await prisma.trackedSignal.update({
    where: { id: tracked.id },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closePrice: new Prisma.Decimal(body.closePrice),
      personalPnl: new Prisma.Decimal(personalPnl),
      notes: body.notes ? sanitizeText(body.notes) : tracked.notes,
    },
  });

  return NextResponse.json({
    id: updated.id,
    personalPnl,
    ok: true,
  });
}
