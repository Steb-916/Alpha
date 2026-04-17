"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  useAlertNotifications,
  type AlertHistoryItem,
} from "@/hooks/useAlertNotifications";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AlertBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unreadCount, markAllRead } = useAlertNotifications(30_000);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          transition: "all 0.2s ease",
        }}
        title="Alerts"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full text-[8px] font-bold leading-[14px] text-center"
            style={{ background: "var(--accent-red)", color: "white" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-[var(--radius-md)] z-50 overflow-hidden"
          style={{
            background: "var(--surface-modal, var(--glass-bg))",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "var(--glass-shadow-hover)",
          }}
        >
          <div
            className="px-3 py-2 text-xs font-body uppercase tracking-wider"
            style={{
              color: "var(--text-tertiary)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            Recent Alerts
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-xs font-body"
                style={{ color: "var(--text-muted)" }}
              >
                No recent alerts.
              </div>
            ) : (
              items.map((item: AlertHistoryItem) => (
                <div
                  key={item.id}
                  className="px-3 py-2 text-xs font-body"
                  style={{ borderBottom: "1px solid var(--glass-border)" }}
                >
                  <div style={{ color: "var(--text-primary)" }}>
                    {item.asset} {item.type} {item.condition} {item.threshold}
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    actual {item.actualValue.toFixed(4)} — {formatTimeAgo(item.triggeredAt)}
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/settings/alerts"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-xs font-body text-center"
            style={{
              color: "var(--accent-green)",
              borderTop: "1px solid var(--glass-border)",
            }}
          >
            Manage alerts →
          </Link>
        </div>
      )}
    </div>
  );
}
