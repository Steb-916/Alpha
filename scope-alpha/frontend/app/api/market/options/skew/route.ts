import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import type { SkewOutput } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'BTC/ETH only' }, { status: 400 });
  }

  const key = `options:skew:${asset}`;
  const fresh = await getCached<SkewOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<SkewOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    {
      error: quantEngine.configured
        ? 'Skew not yet computed'
        : 'Quant Engine not configured',
      quantEngineConfigured: quantEngine.configured,
    },
    { status: 503 },
  );
}
