import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { getEtfFlowData } from '@/lib/macro/fetchers';
import type { EtfFlowData } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KEY = 'macro:etf-flows';
const TTL = 3600;

export async function GET() {
  const fresh = await getCached<EtfFlowData>(KEY);
  if (fresh) return NextResponse.json(fresh);

  const data = getEtfFlowData();
  await setCached(KEY, data, TTL);
  return NextResponse.json(data);
}
