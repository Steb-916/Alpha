/**
 * PUT    /api/signal-templates/[id]  — update an existing template
 * DELETE /api/signal-templates/[id]  — delete a template
 *
 * Both require the caller to be the template's owning analyst.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { RelativeTarget } from '@/lib/signals/templates';
import { ensureRateLimit } from '@/lib/rateLimit';
import { sanitizeText, sanitizeRichText } from '@/lib/sanitize';

async function ensureOwner(
  id: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const tpl = await prisma.signalTemplate.findUnique({
    where: { id },
    select: { analystId: true },
  });
  if (!tpl) return { ok: false, status: 404, error: 'Not found' };
  if (tpl.analystId !== userId)
    return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true };
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('default', request, session.user.id);
  if (limited) return limited;

  const own = await ensureOwner(params.id, session.user.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: {
    name?: string;
    asset?: string | null;
    direction?: string | null;
    timeframe?: string | null;
    conviction?: string | null;
    stopPercent?: number | null;
    targets?: RelativeTarget[] | null;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Same target validation as POST when targets are supplied.
  if (Array.isArray(body.targets)) {
    let totalPct = 0;
    for (const t of body.targets) {
      if (!t.label || typeof t.percentFromEntry !== 'number' || typeof t.closePercent !== 'number') {
        return NextResponse.json(
          { error: 'Each template target needs label, percentFromEntry, closePercent' },
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

  const updated = await prisma.signalTemplate.update({
    where: { id: params.id },
    data: {
      name: body.name ? sanitizeText(body.name) : undefined,
      asset: body.asset,
      direction: body.direction,
      timeframe: body.timeframe,
      conviction: body.conviction,
      stopPercent: body.stopPercent,
      targets: body.targets ? (body.targets as object) : undefined,
      notes: body.notes != null ? (body.notes ? sanitizeRichText(body.notes) : null) : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limited = await ensureRateLimit('default', request, session.user.id);
  if (limited) return limited;

  const own = await ensureOwner(params.id, session.user.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  await prisma.signalTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
