/**
 * Alert runner.
 *
 * For a single asset + the freshly fetched market context, load all active
 * alerts that match the asset, evaluate each, and fire any that pass both
 * the condition check and the throttle gate.
 *
 * Firing = create AlertHistory row + update Alert.lastTriggered and
 * triggerCount + dispatch notifications (email / telegram).
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { evaluateAlert, type EvalContext, type AlertLite } from './evaluator';
import { shouldFire } from './throttle';
import { sendAlertEmail } from '@/lib/notifications/email';
import { sendTelegramMessage, formatAlertMessage } from '@/lib/notifications/telegram';

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
        name: true,
        notifyEmail: true,
        notifyTelegram: true,
        lastTriggered: true,
        userId: true,
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

        // Dispatch external notifications (fire-and-forget, non-blocking)
        if (alert.notifyEmail || alert.notifyTelegram) {
          void dispatchNotifications(alert, result.actualValue);
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

async function dispatchNotifications(
  alert: {
    id: string;
    userId: string;
    name: string;
    asset: string;
    type: string;
    condition: string;
    value: number;
    notifyEmail: boolean;
    notifyTelegram: boolean;
  },
  actualValue: number,
): Promise<void> {
  try {
    const [user, prefs] = await Promise.all([
      prisma.user.findUnique({ where: { id: alert.userId }, select: { email: true } }),
      prisma.userPreferences.findUnique({ where: { userId: alert.userId }, select: { telegramChatId: true } }),
    ]);

    const payload = {
      alertName: alert.name,
      asset: alert.asset,
      type: alert.type,
      condition: alert.condition,
      threshold: alert.value,
      actualValue,
    };

    if (alert.notifyEmail && user?.email) {
      await sendAlertEmail({ to: user.email, ...payload });
    }

    if (alert.notifyTelegram && prefs?.telegramChatId) {
      const text = formatAlertMessage(payload);
      await sendTelegramMessage(prefs.telegramChatId, text);
    }
  } catch (err) {
    log('warn', 'dispatchNotifications failed', {
      metadata: { alertId: alert.id, error: (err as Error).message },
    });
  }
}
