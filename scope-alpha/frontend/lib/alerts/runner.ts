/**
 * Alert runner.
 *
 * For a single asset + the freshly fetched market context, load all active
 * alerts that match the asset, evaluate each, and fire any that pass both
 * the condition check and the throttle gate.
 *
 * Firing = create AlertHistory row + update Alert.lastTriggered and
 * triggerCount. All writes are best-effort and will not throw back to the
 * caller — the cron job should continue even if alert writes fail.
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { evaluateAlert, type EvalContext, type AlertLite } from './evaluator';
import { shouldFire } from './throttle';

export async function runAlertsForAsset(
  asset: string,
  ctx: EvalContext,
): Promise<number> {
  let firedCount = 0;
  try {
    const alerts = await prisma.alert.findMany({
      where: { asset, isActive: true },
      select: {
        id: true,
        type: true,
        condition: true,
        value: true,
        asset: true,
        lastTriggered: true,
        lastObservedState: true,
      },
    });

    for (const alert of alerts) {
      try {
        const lite: AlertLite = {
          id: alert.id,
          type: alert.type,
          condition: alert.condition,
          value: alert.value,
          asset: alert.asset,
          lastObservedState: alert.lastObservedState,
        };

        // Slice 3 state-seeding path: even when shouldFire throttles us, we
        // still want to evaluate so that first-observation state seeding
        // (regime-change alerts) happens during the cron's throttle window.
        // evaluator doesn't fire in the null-seed case, so this is safe.
        const result = await evaluateAlert(lite, ctx);

        // Throttle check happens AFTER eval so we can persist state advances
        // (lastObservedState) even during throttle windows. We only suppress
        // the fire + AlertHistory write when throttled.
        const throttleAllowsFire = shouldFire({
          lastTriggered: alert.lastTriggered,
        });
        const shouldPersistState =
          result.nextObservedState !== undefined &&
          result.nextObservedState !== alert.lastObservedState;

        if (result.triggered && throttleAllowsFire) {
          await prisma.$transaction([
            prisma.alertHistory.create({
              data: {
                alertId: alert.id,
                asset: alert.asset,
                type: alert.type,
                condition: alert.condition,
                threshold: alert.value,
                actualValue: result.actualValue,
              },
            }),
            prisma.alert.update({
              where: { id: alert.id },
              data: {
                lastTriggered: new Date(),
                triggerCount: { increment: 1 },
                ...(shouldPersistState
                  ? { lastObservedState: result.nextObservedState }
                  : {}),
              },
            }),
          ]);
          firedCount++;
        } else if (shouldPersistState) {
          // Not firing (either not triggered or throttled), but the
          // durable state still needs to advance. Applies to first-observation
          // seeding of regime-change alerts.
          await prisma.alert.update({
            where: { id: alert.id },
            data: { lastObservedState: result.nextObservedState },
          });
        }
      } catch (err) {
        log('warn', 'alert fire failed', {
          metadata: {
            alertId: alert.id,
            asset,
            error: (err as Error).message,
          },
        });
      }
    }
  } catch (err) {
    log('warn', 'runAlertsForAsset failed', {
      metadata: { asset, error: (err as Error).message },
    });
  }
  return firedCount;
}
