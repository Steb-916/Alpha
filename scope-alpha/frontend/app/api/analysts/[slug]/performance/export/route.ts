/**
 * GET /api/analysts/[slug]/performance/export?format=csv
 *
 * CSV download of all the analyst's resolved signals. Owner-only.
 *
 * The Phase 4 PRD only specifies CSV; PDF can be added later via the PDF
 * skill or a headless browser snapshot.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { signalsToCSV } from '@/lib/analytics/export';
import { serializeSignal } from '@/lib/signals/serializer';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const analyst = await prisma.user.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!analyst) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (analyst.id !== session.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signals = await prisma.signal.findMany({
    where: { analystId: analyst.id, status: { in: ['active', 'resolved'] } },
    include: { targets: { orderBy: { order: 'asc' } } },
    orderBy: { publishedAt: 'desc' },
  });

  const serialized = signals.map(serializeSignal);
  const csv = signalsToCSV(serialized);

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="scope-alpha-performance-${params.slug}-${date}.csv"`,
    },
  });
}
