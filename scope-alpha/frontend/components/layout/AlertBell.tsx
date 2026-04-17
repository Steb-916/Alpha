"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

interface AlertHistoryItem {
  id: string;
  asset: string;
  type: string;
  condition: string;
  threshold: number;
  actualValue: number;
  triggeredAt: string;
}

/**
 * Notification bell. Polls /api/alerts/history for recent alert triggers.
 * Phase 0 stores alerts but does not trigger them — this will show an empty
 * list until Phase 2's trigger engine starts writing rows.
 */
export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts/history?limit=20");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  const unread = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          transition: "all 0.2s ease",
        }}
        title="Alerts"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full text-[8px] font-bold leading-[14px] text-center"
            style={{ background: "var(--accent-red)", color: "white" }}
          >
            {unread > 9 ? "9+" : unread}
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
            {loading ? (
              <div
                className="px-3 py-6 text-center text-xs font-body"
                style={{ color: "var(--text-muted)" }}
              >
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div
                className="px-3 py-6 text-center text-xs font-body"
                style={{ color: "var(--text-muted)" }}
              >
                No recent alerts.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 text-xs font-body"
                  style={{ borderBottom: "1px solid var(--glass-border)" }}
                >
                  <div style={{ color: "var(--text-primary)" }}>
                    {item.asset} {item.type} {item.condition} {item.threshold}
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    actual {item.actualValue} —{" "}
                    {new Date(item.triggeredAt).toLocaleString()}
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
