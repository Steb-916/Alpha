'use client';

/**
 * Hook for connection status UI indicator.
 */

import { useMarketDataStore } from '@/lib/marketDataStore';

export function useConnectionStatus() {
  const connectionStatus = useMarketDataStore((s) => s.connectionStatus);
  const lastHeartbeat = useMarketDataStore((s) => s.lastHeartbeat);

  const isConnected = connectionStatus === 'connected';
  const isError = connectionStatus === 'error';
  const isConnecting = connectionStatus === 'connecting';

  const statusLabel = (() => {
    switch (connectionStatus) {
      case 'connected': return 'Live';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Reconnecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  })();

  const statusColor = (() => {
    switch (connectionStatus) {
      case 'connected': return '#10B981';    // green
      case 'connecting': return '#F59E0B';   // yellow
      case 'error': return '#EF4444';         // red
      case 'disconnected': return '#6B7280';  // gray
      default: return '#6B7280';
    }
  })();

  return {
    connectionStatus,
    isConnected,
    isError,
    isConnecting,
    statusLabel,
    statusColor,
    lastHeartbeat,
  };
}
