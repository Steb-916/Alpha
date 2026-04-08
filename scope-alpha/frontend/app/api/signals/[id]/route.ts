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
import { serializeSignal, type SerializedSignal } from '@/lib/signals/serializer';
import { checkSubscriptionAccess } from '@/lib/subscriptions';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeRichText } from '@/lib/sanitize';
import { captureRouteError } from '@/lib/sentry';

// GET /api/signals/[id]
//
// Phase 6: public single-signal endpoint used by the share landing page.
// Auth optional. If the viewer doesn't have subscription access via the
// Phase 4 stub, gated price/notes fields are stripped (replaced with null
// placeholders) so the response is safe to render on a public OG landing.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    include: {
      targets: { orderBy: { order: 'asc' } },
      analyst: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          name: true,
          email: true,
          avatarUrl: true,
          analystPerformance: {
            select: {
              winRate: true,
              totalSignals: true,
              subscriberCount: true,
            },
          },
          subscriptionTiers: {
            where: { isActive: true },
            orderBy: { priceUsd: 'asc' },
            take: 1,
          },
          // Like/bookmark relations let us compute viewer flags in one query.
          ...(viewerId
            ? {}
            : {}),
        },
      },
    },
  });

  if (!signal || signal.status === 'draft') {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  // Determine access. Self → always full. Otherwise check via stub.
  let hasAccess = false;
  if (viewerId === signal.analystId) {
    hasAccess = true;
  } else if (viewerId) {
    const access = await checkSubscriptionAccess(viewerId, signal.analystId);
    hasAccess = access.hasAccess;
  }

  // Per-viewer like/bookmark flags.
  let isLiked = false;
  let isBookmarked = false;
  if (viewerId) {
    const [likeRow, bookmarkRow] = await Promise.all([
      prisma.signalLike.findUnique({
        where: { userId_signalId: { userId: viewerId, signalId: signal.id } },
        select: { id: true },
      }),
      prisma.signalBookmark.findUnique({
        where: { userId_signalId: { userId: viewerId, signalId: signal.id } },
        select: { id: true },
      }),
    ]);
    isLiked = !!likeRow;
    isBookmarked = !!bookmarkRow;
  }

  let serialized: SerializedSignal = serializeSignal(signal);

  // Strip gated fields for non-subscribers.
  if (!hasAccess) {
    serialized = {
      ...serialized,
      entryPrice: 0,
      targetPrice: 0,
      stopLossPrice: 0,
      notes: null,
      targets: serialized.targets.map((t) => ({
        ...t,
        price: 0,
        hitPrice: null,
      })),
    };
  }

  const cheapestTier = signal.analyst.subscriptionTiers[0] ?? null;

  return NextResponse.json({
    signal: serialized,
    analyst: {
      id: signal.analyst.id,
      slug: signal.analyst.slug ?? signal.analyst.id,
      displayName:
        signal.analyst.displayName || signal.analyst.name || 'Unknown',
      avatarInitial:
        ((signal.analyst.displayName ||
          signal.analyst.name ||
          signal.analyst.email)[0] ?? '?').toUpperCase(),
      avatarUrl: signal.analyst.avatarUrl,
      winRate: signal.analyst.analystPerformance?.winRate
        ? Number(signal.analyst.analystPerformance.winRate)
        : null,
      totalSignals: signal.analyst.analystPerformance?.totalSignals ?? 0,
      subscriberCount: signal.analyst.analystPerformance?.subscriberCount ?? 0,
      lowestTierPrice: cheapestTier ? cheapestTier.priceUsd / 100 : null,
    },
    viewer: {
      isAuthenticated: !!viewerId,
      hasAccess,
      isLiked,
      isBookmarked,
    },
  });
}

// PATCH /api/signals/[id]
//
// Drafts: any field can be edited.
// Active/resolved: only `notes` and `status='cancelled'` are allowed.
// Price/direction/target fields are immutable on active signals — this is
// the platform's "timestamped, immutable signal" guarantee.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('signals/create', request, session.user.id);
  if (limited) return limited;

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    include: { targets: true },
  });

  if (!signal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (signal.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // ── Draft path: full edit allowed ──
    if (signal.status === 'draft') {
      // Validate the full body if it has the required fields. Drafts can be
      // partially updated, so accept either a full SignalBodyInput or a
      // partial update.
      const isFullBody =
        body.assetSymbol !== undefined &&
        body.direction !== undefined &&
        body.entryPrice !== undefined &&
        body.stopLossPrice !== undefined &&
        body.timeframe !== undefined;

      if (isFullBody) {
        const fullBody = body as SignalBodyInput;
        const bodyResult = validateSignalBody(fullBody);
        if (!bodyResult.ok) {
          return NextResponse.json(
            { error: bodyResult.errors[0].message, errors: bodyResult.errors },
            { status: 400 },
          );
        }

        let targets: SignalTargetInput[];
        if (Array.isArray(fullBody.targets) && fullBody.targets.length > 0) {
          const tr = validateTargets(
            fullBody.targets,
            fullBody.direction,
            fullBody.entryPrice,
          );
          if (!tr.ok) {
            return NextResponse.json(
              { error: tr.errors[0].message, errors: tr.errors },
              { status: 400 },
            );
          }
          targets = fullBody.targets;
        } else if (typeof fullBody.targetPrice === 'number') {
          targets = [
            { label: 'TP1', price: fullBody.targetPrice, closePercent: 100 },
          ];
        } else {
          return NextResponse.json(
            { error: 'targetPrice or targets[] required' },
            { status: 400 },
          );
        }

        // Replace target rows in a transaction.
        await prisma.$transaction([
          prisma.signalTarget.deleteMany({ where: { signalId: signal.id } }),
          prisma.signal.update({
            where: { id: signal.id },
            data: {
              assetSymbol: fullBody.assetSymbol,
              direction: fullBody.direction,
              entryPrice: new Prisma.Decimal(fullBody.entryPrice),
              targetPrice: new Prisma.Decimal(targets[0].price),
              stopLossPrice: new Prisma.Decimal(fullBody.stopLossPrice),
              timeframe: fullBody.timeframe,
              conviction: fullBody.conviction || 'medium',
              notes: fullBody.notes ? sanitizeRichText(fullBody.notes) : null,
              templateId: fullBody.templateId ?? null,
              screenshotUrl: fullBody.screenshotUrl ?? null,
              targets: {
                create: targets.map((t, idx) => ({
                  label: t.label,
                  price: new Prisma.Decimal(t.price),
                  closePercent: t.closePercent,
                  order: idx + 1,
                })),
              },
            },
          }),
        ]);
      } else {
        // Partial update on a draft — just patch the simple scalar fields
        // we receive. Don't allow status change here (use /publish for that).
        const updateData: Record<string, unknown> = {};
        if ('notes' in body) updateData.notes = body.notes ? sanitizeRichText(body.notes) : null;
        if ('screenshotUrl' in body) updateData.screenshotUrl = body.screenshotUrl;
        if ('templateId' in body) updateData.templateId = body.templateId;
        if (Object.keys(updateData).length > 0) {
          await prisma.signal.update({ where: { id: signal.id }, data: updateData });
        }
      }

      const updated = await prisma.signal.findUnique({
        where: { id: signal.id },
        include: { targets: { orderBy: { order: 'asc' } } },
      });
      return NextResponse.json(serializeSignal(updated!));
    }

    // ── Active/resolved path: only notes + status=cancelled ──
    const updateData: Record<string, unknown> = {};

    if (body.notes !== undefined) {
      updateData.notes = body.notes ? sanitizeRichText(body.notes) : null;
    }

    if (body.status === 'cancelled' && signal.status === 'active') {
      updateData.status = 'cancelled';
    }

    if (
      body.entryPrice !== undefined ||
      body.targetPrice !== undefined ||
      body.stopLossPrice !== undefined ||
      body.direction !== undefined ||
      body.publishedAt !== undefined ||
      body.targets !== undefined
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot modify immutable signal fields (entry, target, stop, direction, targets, publishedAt) once published',
        },
        { status: 400 },
      );
    }

    const updated = await prisma.signal.update({
      where: { id: signal.id },
      data: updateData,
      include: { targets: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json(serializeSignal(updated));
  } catch (error) {
    captureRouteError(error, { route: '/api/signals/[id] PATCH', userId: session.user.id });
    return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
  }
}

// DELETE /api/signals/[id] — only for drafts
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('signals/create', request, session.user.id);
  if (limited) return limited;

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    select: { id: true, analystId: true, status: true },
  });
  if (!signal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (signal.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (signal.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft signals can be deleted' },
      { status: 400 },
    );
  }

  await prisma.signal.delete({ where: { id: signal.id } });
  return NextResponse.json({ ok: true });
}
