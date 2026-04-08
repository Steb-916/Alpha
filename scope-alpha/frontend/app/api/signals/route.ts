import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  validateSignalBody,
  validateTargets,
  type SignalBodyInput,
  type SignalTargetInput,
} from '@/lib/signals/validation';
import { serializeSignal } from '@/lib/signals/serializer';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeRichText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

// GET /api/signals?analystId=...&status=active&assetSymbol=BTC
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get('analystId');
  const status = searchParams.get('status');
  const assetSymbol = searchParams.get('assetSymbol');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: Record<string, unknown> = {};
  if (analystId) where.analystId = analystId;
  if (status) where.status = status;
  if (assetSymbol) where.assetSymbol = assetSymbol;

  // Drafts are private — only the owning analyst can see them.
  // If the caller filters by status='draft', enforce ownership.
  if (status === 'draft' && analystId !== session.user.id) {
    where.analystId = session.user.id;
  }

  const signals = await prisma.signal.findMany({
    where,
    include: { targets: { orderBy: { order: 'asc' } } },
    orderBy: { publishedAt: 'desc' },
    take: Math.min(limit, 100),
  });

  return NextResponse.json(signals.map(serializeSignal));
}

// POST /api/signals — create new signal (analyst only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'analyst') {
    return NextResponse.json(
      { error: 'Only analysts can create signals' },
      { status: 403 },
    );
  }

  const limited = await ensureRateLimit('signals/create', request, session.user.id);
  if (limited) return limited;

  // Phase 7: gate creation on the analyst publishing agreement.
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
    const body = (await request.json()) as SignalBodyInput;

    // Body validation (asset, direction, entry, stop, timeframe, etc.)
    const bodyResult = validateSignalBody(body);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: bodyResult.errors[0].message, errors: bodyResult.errors },
        { status: 400 },
      );
    }

    // Multi-target vs single-target normalization.
    // If the client sent targets[], use those. Otherwise synthesize a single
    // target from the legacy `targetPrice` field for backward compat with
    // the existing NewSignalForm.
    let targets: SignalTargetInput[];
    if (Array.isArray(body.targets) && body.targets.length > 0) {
      const targetResult = validateTargets(body.targets, body.direction, body.entryPrice);
      if (!targetResult.ok) {
        return NextResponse.json(
          { error: targetResult.errors[0].message, errors: targetResult.errors },
          { status: 400 },
        );
      }
      targets = body.targets;
    } else {
      if (typeof body.targetPrice !== 'number') {
        return NextResponse.json(
          { error: 'targetPrice or targets[] required' },
          { status: 400 },
        );
      }
      // Synthesize a single TP1 with full close. Validate it the same way.
      const synthesized: SignalTargetInput[] = [
        { label: 'TP1', price: body.targetPrice, closePercent: 100 },
      ];
      const targetResult = validateTargets(synthesized, body.direction, body.entryPrice);
      if (!targetResult.ok) {
        return NextResponse.json(
          { error: targetResult.errors[0].message, errors: targetResult.errors },
          { status: 400 },
        );
      }
      targets = synthesized;
    }

    const status = body.status || 'active';
    const isDraft = status === 'draft';

    // The legacy `targetPrice` column stores TP1's price so existing
    // queries (and clients that haven't been upgraded) keep working.
    const legacyTargetPrice = targets[0].price;

    const signal = await prisma.signal.create({
      data: {
        analystId: session.user.id,
        assetSymbol: body.assetSymbol,
        direction: body.direction,
        entryPrice: new Prisma.Decimal(body.entryPrice),
        targetPrice: new Prisma.Decimal(legacyTargetPrice),
        stopLossPrice: new Prisma.Decimal(body.stopLossPrice),
        timeframe: body.timeframe,
        conviction: body.conviction || 'medium',
        notes: body.notes ? sanitizeRichText(body.notes) : null,
        status,
        publishedAt: isDraft ? null : new Date(),
        templateId: body.templateId || null,
        screenshotUrl: body.screenshotUrl || null,
        targets: {
          create: targets.map((t, idx) => ({
            label: t.label,
            price: new Prisma.Decimal(t.price),
            closePercent: t.closePercent,
            order: idx + 1,
          })),
        },
      },
      include: { targets: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json(serializeSignal(signal), { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: '/api/signals POST', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 });
  }
}
