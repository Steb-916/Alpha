import { Resend } from 'resend';
import { log } from '@/lib/logger';
import { AlertTriggeredEmail } from '@/emails/AlertTriggered';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'Scope Alpha <alerts@scope-alpha.com>';

export interface AlertEmailPayload {
  to: string;
  alertName: string;
  asset: string;
  type: string;
  condition: string;
  threshold: number;
  actualValue: number;
}

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await resend.emails.send({
      from: FROM,
      to: payload.to,
      subject: `Alert: ${payload.alertName} triggered`,
      react: AlertTriggeredEmail(payload),
    });
  } catch (err) {
    log('warn', 'sendAlertEmail failed', { metadata: { error: (err as Error).message } });
  }
}
