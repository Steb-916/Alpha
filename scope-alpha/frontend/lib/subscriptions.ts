/**
 * Subscription access check — minimal Phase 2 STUB.
 *
 * The Phase 2 plan defines a comprehensive `checkSubscriptionAccess()` with
 * grace period handling, status normalisation across legacy/new spellings,
 * and tier metadata. Phase 2 is not yet implemented in this codebase, so
 * Phase 4 ships this thin shim that just does the simple direct query.
 *
 * The interface intentionally matches the Phase 2 PRD so call sites don't
 * have to change when the real implementation lands — just replace the
 * body of this function.
 */

import { prisma } from '@/lib/prisma';
import type { Subscription, SubscriptionTier } from '@prisma/client';

export type AccessStatus =
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'expired'
  | 'none';

export interface AccessCheck {
  hasAccess: boolean;
  status: AccessStatus;
  subscription: (Subscription & { tier: SubscriptionTier }) | null;
  tier: SubscriptionTier | null;
}

const NO_ACCESS: AccessCheck = {
  hasAccess: false,
  status: 'none',
  subscription: null,
  tier: null,
};

/**
 * Returns the current subscriber's access state for the given analyst.
 *
 * The Phase 4 trade journal and (later) annotation sharing read from this.
 * For analysts viewing their own profile, callers should bypass the check
 * (analystId === session.user.id → always allow).
 */
export async function checkSubscriptionAccess(
  subscriberId: string,
  analystId: string,
): Promise<AccessCheck> {
  if (!subscriberId || !analystId) return NO_ACCESS;

  // Self-access: an analyst always has access to their own content.
  if (subscriberId === analystId) {
    return { hasAccess: true, status: 'active', subscription: null, tier: null };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { subscriberId, analystId },
    include: { tier: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) return NO_ACCESS;

  // Treat both `'active'` and the legacy single-mock value as full access.
  // Phase 2 will replace this with grace-period-aware logic.
  if (subscription.status === 'active') {
    return {
      hasAccess: true,
      status: 'active',
      subscription,
      tier: subscription.tier,
    };
  }

  // Cancelled subscriptions still grant access until currentPeriodEnd.
  if (
    (subscription.status === 'cancelled' || subscription.status === 'canceled') &&
    subscription.currentPeriodEnd > new Date()
  ) {
    return {
      hasAccess: true,
      status: 'active',
      subscription,
      tier: subscription.tier,
    };
  }

  return {
    hasAccess: false,
    status: 'expired',
    subscription,
    tier: subscription.tier,
  };
}
