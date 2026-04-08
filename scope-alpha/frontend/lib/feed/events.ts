/**
 * Feed event creation + milestone checker.
 *
 * - createFeedEvent(): single source of truth for inserting FeedEvent rows.
 * - checkAndCreateMilestones(analystId): called after every signal resolution
 *   to check whether the analyst just crossed a milestone threshold and emit
 *   the celebratory event. Idempotent via a per-event-type/per-count guard.
 *
 * Win-streak compute: queries the analyst's most recent resolved signals
 * sorted DESC by `resolvedAt`, walks forward counting consecutive `isWin`
 * until the first non-win. No new schema field needed.
 */

import { prisma } from '@/lib/prisma';
import { isWin } from '@/lib/analytics/metrics';

export type FeedEventType =
  | 'signal_published'
  | 'signal_resolved'
  | 'milestone_signals'
  | 'milestone_subscribers'
  | 'milestone_winstreak'
  | 'announcement'
  | 'new_analyst';

export type FeedVisibility = 'public' | 'subscribers';

export interface CreateFeedEventInput {
  type: FeedEventType;
  actorId: string;
  analystId?: string;
  signalId?: string;
  metadata?: Record<string, unknown>;
  visibility?: FeedVisibility;
}

export async function createFeedEvent(
  input: CreateFeedEventInput,
): Promise<void> {
  try {
    await prisma.feedEvent.create({
      data: {
        type: input.type,
        actorId: input.actorId,
        analystId: input.analystId ?? null,
        signalId: input.signalId ?? null,
        metadata: (input.metadata as object | undefined) ?? undefined,
        visibility: input.visibility ?? 'public',
      },
    });
  } catch (err) {
    // Feed events are best-effort — never block the parent operation.
    console.error('[feed/events] createFeedEvent failed:', err);
  }
}

// ─── Milestone thresholds ───────────────────────────────────────────────────

const SIGNAL_THRESHOLDS = [50, 100, 250, 500] as const;
const SUBSCRIBER_THRESHOLDS = [10, 50, 100, 500] as const;
const WINSTREAK_THRESHOLDS = [5, 10, 15] as const;

/**
 * Idempotent milestone check. Called after every signal resolution.
 *
 * Reads the freshly-updated AnalystPerformance row (the resolution route
 * calls recomputeAnalystPerformance BEFORE this function), then checks
 * each milestone type for an exact threshold match. The current win streak
 * is computed on-the-fly from recent resolved signals.
 *
 * The idempotency guard uses a JSONB path query against the existing
 * milestone events to ensure we never emit a duplicate for the same count.
 */
export async function checkAndCreateMilestones(
  analystId: string,
): Promise<void> {
  try {
    const perf = await prisma.analystPerformance.findUnique({
      where: { analystId },
    });

    // Total signals milestone.
    if (perf && SIGNAL_THRESHOLDS.includes(perf.totalSignals as never)) {
      await createMilestoneIfNew(analystId, 'milestone_signals', perf.totalSignals);
    }

    // Subscriber count milestone.
    if (perf && SUBSCRIBER_THRESHOLDS.includes(perf.subscriberCount as never)) {
      await createMilestoneIfNew(
        analystId,
        'milestone_subscribers',
        perf.subscriberCount,
      );
    }

    // Win-streak milestone — computed on the fly.
    const currentStreak = await computeCurrentWinStreak(analystId);
    if (WINSTREAK_THRESHOLDS.includes(currentStreak as never)) {
      await createMilestoneIfNew(
        analystId,
        'milestone_winstreak',
        currentStreak,
      );
    }
  } catch (err) {
    console.error('[feed/events] milestone check failed:', err);
  }
}

async function createMilestoneIfNew(
  analystId: string,
  type: 'milestone_signals' | 'milestone_subscribers' | 'milestone_winstreak',
  count: number,
): Promise<void> {
  // Idempotency: check whether we already emitted this exact milestone.
  const existing = await prisma.feedEvent.findFirst({
    where: {
      actorId: analystId,
      type,
      metadata: { path: ['count'], equals: count },
    },
    select: { id: true },
  });
  if (existing) return;

  await createFeedEvent({
    type,
    actorId: analystId,
    analystId,
    metadata: { count },
    visibility: 'public',
  });
}

/**
 * Walks the analyst's most recent resolved signals (DESC by resolvedAt) and
 * counts consecutive wins until hitting the first non-win. Returns 0 when
 * the most recent signal was a loss/breakeven.
 *
 * Caps at 50 signals to bound the query — anyone with a 50-signal streak
 * is firmly past every threshold we care about.
 */
async function computeCurrentWinStreak(analystId: string): Promise<number> {
  const recent = await prisma.signal.findMany({
    where: {
      analystId,
      status: 'resolved',
      resultPnlPercent: { not: null },
    },
    select: { resultPnlPercent: true, resolvedAt: true },
    orderBy: { resolvedAt: 'desc' },
    take: 50,
  });

  let streak = 0;
  for (const s of recent) {
    const pnl = s.resultPnlPercent != null ? Number(s.resultPnlPercent) : null;
    if (isWin({ resultPnlPercent: pnl })) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
