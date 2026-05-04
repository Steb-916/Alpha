import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { getTokenUnlockCalendar } from '@/lib/macro/fetchers';
import type { TokenUnlockCalendar } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KEY = 'macro:token-unlocks';
const TTL = 3600;

export async function GET() {
  const fresh = await getCached<TokenUnlockCalendar>(KEY);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await getTokenUnlockCalendar();
    await setCached(KEY, data, TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[macro/token-unlocks] failed:', err);
    return NextResponse.json({ error: 'Token unlock data unavailable' }, { status: 503 });
  }
}
