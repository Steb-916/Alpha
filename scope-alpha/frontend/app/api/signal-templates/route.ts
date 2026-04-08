/**
 * GET /api/signal-templates           — list current analyst's templates
 * GET /api/signal-templates?analystId — list a specific analyst's templates
 *                                       (only the owner can see their list)
 * POST /api/signal-templates          — create a new template (analyst only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ALLOWED_CONVICTIONS, ALLOWED_DIRECTIONS, ALLOWED_TIMEFRAMES } from '@/config/signals';
import type { RelativeTarget } from '@/lib/signals/templates';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeText, sanitizeRichText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get('analystId') || session.user.id;

  // Templates are private to the owning analyst.
  if (analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const templates = await prisma.signalTemplate.findMany({
    where: { analystId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'analyst') {
    return NextResponse.json(
      { error: 'Only analysts can create templates' },
      { status: 403 },
    );
  }

  const limited = await ensureRateLimit('default', request, session.user.id);
  if (limited) return limited;

  try {

  let body: {
    name?: string;
    asset?: string;
    direction?: string;
    timeframe?: string;
    conviction?: string;
    stopPercent?: number;
    targets?: RelativeTarget[];
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.length < 1) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (
    body.direction != null &&
    !ALLOWED_DIRECTIONS.includes(body.direction as never)
  ) {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
  }
  if (
    body.timeframe != null &&
    !ALLOWED_TIMEFRAMES.includes(body.timeframe as never)
  ) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
  }
  if (
    body.conviction != null &&
    !ALLOWED_CONVICTIONS.includes(body.conviction as never)
  ) {
    return NextResponse.json({ error: 'Invalid conviction' }, { status: 400 });
  }

  // Validate the relative-targets structure if present.
  if (Array.isArray(body.targets)) {
    let totalPct = 0;
    for (const t of body.targets) {
      if (!t.label || typeof t.percentFromEntry !== 'number' || typeof t.closePercent !== 'number') {
        return NextResponse.json(
          { error: 'Each template target needs label, percentFromEntry, closePercent' },
          { status: 400 },
        );
      }
      if (t.percentFromEntry <= 0) {
        return NextResponse.json(
          { error: 'percentFromEntry must be a positive number' },
          { status: 400 },
        );
      }
      totalPct += t.closePercent;
    }
    if (body.targets.length > 0 && Math.abs(totalPct - 100) > 0.01) {
      return NextResponse.json(
        { error: `template target closePercents must sum to 100 (got ${totalPct})` },
        { status: 400 },
      );
    }
  }

  const created = await prisma.signalTemplate.create({
    data: {
      analystId: session.user.id,
      name: sanitizeText(body.name),
      asset: body.asset || null,
      direction: body.direction || null,
      timeframe: body.timeframe || null,
      conviction: body.conviction || null,
      stopPercent: typeof body.stopPercent === 'number' ? body.stopPercent : null,
      targets: body.targets ? (body.targets as object) : undefined,
      notes: body.notes ? sanitizeRichText(body.notes) : null,
    },
  });

  return NextResponse.json(created, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: '/api/signal-templates POST', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
