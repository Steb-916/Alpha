/**
 * POST /api/telegram/webhook
 *
 * Receives updates from the Telegram Bot API.
 * Handles /start <token> command to link a Telegram chat ID to a user account.
 *
 * Set webhook via:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<DEPLOY_URL>/api/telegram/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function reply(chatId: number | string, text: string) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id;
    const text: string = message.text ?? '';

    if (text.startsWith('/start')) {
      const parts = text.trim().split(/\s+/);
      const token = parts[1]; // /start <connect_token>

      if (!token) {
        await reply(chatId, 'Welcome to Scope Alpha!\n\nTo link your account, go to Settings → Alerts → Connect Telegram and follow the instructions.');
        return NextResponse.json({ ok: true });
      }

      // Token format: "tg_<userId>"
      if (!token.startsWith('tg_')) {
        await reply(chatId, 'Invalid link token. Please generate a new one from Settings → Alerts.');
        return NextResponse.json({ ok: true });
      }

      const userId = token.slice(3);
      try {
        await prisma.userPreferences.upsert({
          where: { userId },
          create: { userId, telegramChatId: String(chatId) },
          update: { telegramChatId: String(chatId) },
        });
        await reply(chatId, '✅ Your Telegram account is now linked to Scope Alpha!\n\nYou\'ll receive alert notifications here. You can manage alerts in Settings → Alerts.');
      } catch {
        await reply(chatId, 'Failed to link account. Please try again or contact support.');
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    log('warn', 'telegram webhook error', { metadata: { error: (err as Error).message } });
    return NextResponse.json({ ok: true }); // Always 200 to Telegram
  }
}
