/**
 * Notification dispatcher — Phase 3 STUB.
 *
 * Phase 4 needs to call into a notification dispatcher when a draft signal
 * is published, but Phase 3 (the real dispatcher) is not yet implemented.
 * This file exposes the same `dispatchNotification` API surface so Phase 4
 * call sites don't have to change when the real implementation lands —
 * just swap the body of this function.
 */

// Phase 7: not-financial-advice disclaimer appended to every signal-related
// notification body. When Phase 3 lands and switches this to real email +
// Telegram dispatch, the disclaimer travels with the payload automatically.
import { SIGNAL_DISCLAIMER_TEXT } from '@/lib/legal/disclaimer';

export interface NotificationPayload {
  type:
    | 'new_signal'
    | 'signals_batch'
    | 'signal_resolved'
    | 'announcement'
    | 'subscription_confirmed'
    | 'payment_failed';
  recipientIds: string[];
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

const SIGNAL_TYPES: ReadonlySet<NotificationPayload['type']> = new Set([
  'new_signal',
  'signals_batch',
  'signal_resolved',
  'announcement',
]);

export async function dispatchNotification(
  payload: NotificationPayload,
): Promise<void> {
  // Phase 7: append the standard disclaimer to any signal/announcement body.
  const enrichedPayload: NotificationPayload = SIGNAL_TYPES.has(payload.type)
    ? {
        ...payload,
        body: `${payload.body}\n\n---\n${SIGNAL_DISCLAIMER_TEXT}`,
      }
    : payload;

  // STUB: Phase 3 will replace this with multi-channel dispatch (in-app,
  // email, Telegram). For now we just log so signal publication doesn't
  // silently swallow the call.
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[notifications-stub] would dispatch ${enrichedPayload.type} to ${enrichedPayload.recipientIds.length} recipients:`,
      {
        title: enrichedPayload.title,
        body: enrichedPayload.body,
        metadata: enrichedPayload.metadata,
      },
    );
  }
}
