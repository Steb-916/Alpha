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
      },
    });

    for (const alert of alerts) {
      try {
        if (!shouldFire({ lastTriggered: alert.lastTriggered })) continue;

        const lite: AlertLite = {
          id: alert.id,
          type: alert.type,
          condition: alert.condition,
          value: alert.value,
          asset: alert.asset,
        };
        const result = await evaluateAlert(lite, ctx);
        if (!result.triggered) continue;

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
            },
          }),
        ]);
        firedCount++;
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
