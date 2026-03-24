/**
 * GET /api/market-data/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time market data.
 *
 * Query params:
 *   symbols   - Comma-separated symbols (e.g., "BTCUSDT,ETHUSDT")
 *   intervals - Comma-separated intervals (e.g., "1m,1h")
 *   channels  - Comma-separated data types: kline, ticker, funding, liquidation, openInterest
 *
 * Events sent:
 *   kline       - Candlestick updates
 *   ticker      - 24hr ticker updates
 *   funding     - Funding rate + mark price
 *   liquidation - Liquidation events
 *   openInterest - Open interest updates
 *   heartbeat   - Keep-alive every 15s
 */

import { NextRequest } from 'next/server';
import { getStreamCoordinator } from '@/lib/market-data/stream-coordinator';
import { toBinanceSymbol } from '@/lib/exchanges/utils';
import type { SSEClient } from '@/lib/market-data/ws-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const rawSymbols = searchParams.get('symbols') || 'BTCUSDT,ETHUSDT';
  const rawIntervals = searchParams.get('intervals') || '1m';
  const rawChannels = searchParams.get('channels') || 'kline,ticker,funding,liquidation,openInterest';

  const symbols = rawSymbols.split(',').map((s) => toBinanceSymbol(s.trim()));
  const intervals = rawIntervals.split(',').map((i) => i.trim());
  const channels = rawChannels.split(',').map((c) => c.trim());

  const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        if (closed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream closed
          closed = true;
        }
      };

      // Create SSE client
      const client: SSEClient = {
        id: clientId,
        send,
        symbols,
        intervals,
        channels,
      };

      // Initialize coordinator and register client
      const coordinator = getStreamCoordinator();

      (async () => {
        try {
          await coordinator.initialize();
          coordinator.registerClient(client);

          // Send initial snapshot
          await coordinator.sendInitialSnapshot(client);

          // Send initial connected event
          send('heartbeat', {
            timestamp: Date.now(),
            status: 'connected',
            symbols,
            channels,
          });
        } catch (err) {
          console.error('[SSE] Init error:', err);
          send('heartbeat', {
            timestamp: Date.now(),
            status: 'error',
            error: 'Failed to initialize market data streams',
          });
        }
      })();

      // Heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        if (closed) {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          return;
        }
        send('heartbeat', { timestamp: Date.now() });
      }, 15_000);
    },

    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      const coordinator = getStreamCoordinator();
      coordinator.unregisterClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
