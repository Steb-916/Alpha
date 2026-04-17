"use client";

import { useEffect, useRef, useState } from "react";

export interface AlertHistoryItem {
  id: string;
  asset: string;
  type: string;
  condition: string;
  threshold: number;
  actualValue: number;
  triggeredAt: string;
}

interface UseAlertNotificationsResult {
  items: AlertHistoryItem[];
  unreadCount: number;
  markAllRead: () => void;
  refetch: () => Promise<void>;
}

/**
 * Continuously polls /api/alerts/history. Tracks which alerts the user has
 * already seen via a local ref of the newest `triggeredAt` seen + a "last
 * opened" timestamp. Doesn't persist across page reloads — that's fine, the
 * full list shows everything; only the unread badge is per-session.
 */
export function useAlertNotifications(
  pollIntervalMs = 30_000,
): UseAlertNotificationsResult {
  const [items, setItems] = useState<AlertHistoryItem[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => Date.now());
  const mounted = useRef(true);

  async function load() {
    try {
      const res = await fetch("/api/alerts/history?limit=50");
      if (res.ok && mounted.current) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    mounted.current = true;
    load();
    const interval = setInterval(load, pollIntervalMs);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  const unreadCount = items.filter(
    (i) => new Date(i.triggeredAt).getTime() > lastSeen,
  ).length;

  return {
    items,
    unreadCount,
    markAllRead: () => setLastSeen(Date.now()),
    refetch: load,
  };
}
