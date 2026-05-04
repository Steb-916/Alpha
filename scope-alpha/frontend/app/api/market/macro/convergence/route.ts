import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { getEtfFlowData, fetchFearGreed } from '@/lib/macro/fetchers';
import type { ConvergenceScore } from '@/lib/analytics/convergence';
import type { MacroConvergenceScore, MacroSignalDomain } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 900;
const ALLOWED = new Set(['BTC', 'ETH']);

function domainFromPhase5(cs: ConvergenceScore | null, name: 'derivatives' | 'onchain'): MacroSignalDomain {
  if (!cs) {
    return { name: name === 'derivatives' ? 'Derivatives' : 'On-Chain', score: 50, signal: 'neutral', weight: 0.35, keyFactor: 'Data unavailable' };
  }
  const comp = cs.components[name];
  const score = comp.signal === 'bullish' ? 72 : comp.signal === 'bearish' ? 28 : 50;
  return {
    name: name === 'derivatives' ? 'Derivatives' : 'On-Chain',
    score,
    signal: comp.signal === 'neutral' ? 'neutral' : comp.signal,
    weight: name === 'derivatives' ? 0.35 : 0.35,
    keyFactor: comp.reason,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json({ error: 'Convergence available for BTC and ETH only' }, { status: 400 });
  }

  const key = `macro:convergence:${asset}`;
  const fresh = await getCached<MacroConvergenceScore>(key);
  if (fresh) return NextResponse.json(fresh);

  try {
    const [phase5Convergence, fgHistory] = await Promise.all([
      getCached<ConvergenceScore>(`market:convergence:${asset}`),
      fetchFearGreed(5),
    ]);

    const etfData = getEtfFlowData();
    const recentFlows = etfData.dailyFlows.slice(-10).filter((d) => d.totalFlow !== 0);
    const positiveFlows = recentFlows.filter((d) => d.totalFlow > 0).length;
    const etfSignal: MacroSignalDomain['signal'] =
      positiveFlows >= 7 ? 'bullish' : positiveFlows <= 3 ? 'bearish' : 'neutral';
    const etfScore = etfSignal === 'bullish' ? 70 : etfSignal === 'bearish' ? 30 : 50;

    const currentFg = fgHistory[0]?.value ?? 50;
    const fgSignal: MacroSignalDomain['signal'] =
      currentFg <= 30 ? 'bullish' : currentFg >= 70 ? 'bearish' : 'neutral';
    const fgScore = fgSignal === 'bullish' ? 72 : fgSignal === 'bearish' ? 28 : 50;

    const macroScore = Math.round((etfScore + fgScore) / 2);
    const macroDomain: MacroSignalDomain = {
      name: 'Macro',
      score: macroScore,
      signal: macroScore >= 60 ? 'bullish' : macroScore <= 40 ? 'bearish' : 'neutral',
      weight: 0.3,
      keyFactor: `ETF ${etfData.summary.trend} · F&G ${currentFg} (${fgHistory[0]?.label ?? '—'})`,
    };

    const derivDomain = domainFromPhase5(phase5Convergence, 'derivatives');
    const onchainDomain = domainFromPhase5(phase5Convergence, 'onchain');
    const domains = { derivatives: derivDomain, onchain: onchainDomain, macro: macroDomain };

    const scores = [derivDomain.score, onchainDomain.score, macroScore];
    const totalScore = Math.round(
      scores[0] * 0.35 + scores[1] * 0.35 + scores[2] * 0.3
    );

    const bullCount = [derivDomain, onchainDomain, macroDomain].filter((d) => d.signal === 'bullish').length;
    const bearCount = [derivDomain, onchainDomain, macroDomain].filter((d) => d.signal === 'bearish').length;

    const direction: MacroConvergenceScore['direction'] =
      bullCount >= 2 ? 'bullish' : bearCount >= 2 ? 'bearish' : 'mixed';
    const agreementCount = Math.max(bullCount, bearCount);
    const confidence: MacroConvergenceScore['confidence'] =
      agreementCount === 3 ? 'high' : agreementCount === 2 ? 'medium' : 'low';

    const narratives: Record<string, string> = {
      bullish: `${agreementCount}/3 domains signal bullish conditions. Derivatives health, on-chain accumulation, and macro sentiment are aligning.`,
      bearish: `${agreementCount}/3 domains signal elevated risk. Caution is warranted across multiple analytical layers.`,
      mixed: `Domains are diverging. Derivatives and on-chain signals conflict with macro sentiment — proceed with caution.`,
    };

    const result: MacroConvergenceScore = {
      totalScore,
      direction,
      confidence,
      domains,
      agreementCount,
      narrative: narratives[direction],
      computedAt: new Date().toISOString(),
    };

    await Promise.all([setCached(key, result, TTL), setStale(key, result)]);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[macro/convergence] compute failed:', err);
    const stale = await getStale<MacroConvergenceScore>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Convergence data unavailable' }, { status: 503 });
  }
}
