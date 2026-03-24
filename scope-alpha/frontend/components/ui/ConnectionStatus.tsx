'use client';

/**
 * Visual indicator for live data feed connection status.
 * Positioned fixed at bottom-right of the viewport.
 */

import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export function ConnectionStatusIndicator() {
  const { statusLabel, statusColor, isConnected, isError, connectionStatus } = useConnectionStatus();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono"
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Pulsing dot */}
      <span
        className="relative flex h-2 w-2"
      >
        {isConnected && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: statusColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ backgroundColor: statusColor }}
        />
      </span>

      <span style={{ color: statusColor }}>{statusLabel}</span>

      {isError && (
        <span style={{ color: 'var(--text-muted)' }}>
          • Auto-reconnecting
        </span>
      )}
    </div>
  );
}

/**
 * Inline connection badge for use within panels/cards.
 */
export function ConnectionBadge() {
  const { statusLabel, statusColor, isConnected } = useConnectionStatus();

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-pill)] text-[9px] font-mono uppercase tracking-wider"
      style={{
        background: `${statusColor}15`,
        border: `1px solid ${statusColor}30`,
        color: statusColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: statusColor,
          animation: isConnected ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      />
      {statusLabel}
    </span>
  );
}
