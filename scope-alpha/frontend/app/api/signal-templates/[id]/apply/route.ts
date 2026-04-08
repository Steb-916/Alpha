/**
 * POST /api/signal-templates/[id]/apply
 *
 * Body: { entryPrice: number, direction?: 'long'|'short' }
 *
 * Resolves the template's relative percentages into absolute prices anchored
 * at the supplied entry price. Returns a partial signal body the form can
 * merge into its current state.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  applyTemplateToEntry,
  type RelativeTarget,
  type TemplateBody,
} from '@/lib/signals/templates';
import type { Direction } from '@/config/signals';
import { ensureRateLimit } from '@/lib/rateLimit';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limited = await ensureRateLimit('default', request, session.user.id);
  if (limited) return limited;

  const tpl = await prisma.signalTemplate.findUnique({ where: { id: params.id } });
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (tpl.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { entryPrice?: number; direction?: Direction };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.entryPrice !== 'number' || body.entryPrice <= 0) {
    return NextResponse.json(
      { error: 'entryPrice must be a positive number' },
      { status: 400 },
    );
  }

  const templateBody: TemplateBody = {
    asset: tpl.asset,
    direction: tpl.direction as Direction | null,
    timeframe: tpl.timeframe,
    conviction: tpl.conviction,
    stopPercent: tpl.stopPercent,
    targets: (tpl.targets as RelativeTarget[] | null) ?? null,
    notes: tpl.notes,
  };

  const applied = applyTemplateToEntry(templateBody, body.entryPrice, body.direction);
  return NextResponse.json(applied);
}
