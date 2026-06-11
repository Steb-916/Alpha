import { log } from '@/lib/logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      const body = await res.text();
      log('warn', 'telegram sendMessage failed', { metadata: { status: res.status, body } });
    }
  } catch (err) {
    log('warn', 'sendTelegramMessage error', { metadata: { error: (err as Error).message } });
  }
}

export function formatAlertMessage(params: {
  alertName: string;
  asset: string;
  type: string;
  condition: string;
  threshold: number;
  actualValue: number;
}): string {
  const { alertName, asset, type, condition, threshold, actualValue } = params;
  return (
    `🔔 <b>Alert Triggered</b>\n\n` +
    `<b>${alertName}</b>\n` +
    `Asset: ${asset}\n` +
    `Metric: ${type.replace(/_/g, ' ')}\n` +
    `Condition: ${condition.replace(/_/g, ' ')} ${threshold}\n` +
    `Actual: ${actualValue.toFixed(4)}`
  );
}
