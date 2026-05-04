import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { computeCorrelationMatrix } from '@/lib/macro/fetchers';
import type { CorrelationMatrix } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const window = Math.min(90, Math.max(10, parseInt(url.searchParams.get('window') ?? '30') || 30));
  const key = `macro:correlations:${window}d`;

  const fresh = await getCached<CorrelationMatrix>(key);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await computeCorrelationMatrix(window);
    await Promise.all([setCached(key, data, TTL), setStale(key, data)]);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[macro/correlations] compute failed:', err);
    const stale = await getStale<CorrelationMatrix>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Correlation data unavailable' }, { status: 503 });
  }
}
