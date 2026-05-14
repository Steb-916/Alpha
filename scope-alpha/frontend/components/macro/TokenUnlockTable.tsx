"use client";

import type { TokenUnlockEvent } from "@/types/macro";

interface Props {
  events: TokenUnlockEvent[];
}

const TYPE_BADGE: Record<TokenUnlockEvent["type"], { label: string; color: string }> = {
  cliff: { label: "CLIFF", color: "#ef4444" },
  linear: { label: "LINEAR", color: "#f97316" },
  one_time: { label: "ONE-TIME", color: "#a78bfa" },
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtAmount(amount: number, unit: string): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B ${unit}`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M ${unit}`;
  return `${(amount / 1_000).toFixed(0)}K ${unit}`;
}

function fmtUSD(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000_000) return `~$${(v / 1_000_000_000).toFixed(1)}B`;
  return `~$${(v / 1_000_000).toFixed(0)}M`;
}

export function TokenUnlockTable({ events }: Props) {
  if (events.length === 0) {
    return (
      <div
        className="text-xs font-mono text-center py-4"
        style={{ color: "var(--text-muted)" }}
      >
        No upcoming unlock events
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <th className="text-left py-2 pr-4 font-normal">Asset</th>
            <th className="text-left py-2 pr-4 font-normal">Date</th>
            <th className="text-right py-2 pr-4 font-normal">Amount</th>
            <th className="text-right py-2 pr-4 font-normal">USD Est.</th>
            <th className="text-center py-2 pr-4 font-normal">Type</th>
            <th className="text-right py-2 font-normal">In</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const days = daysUntil(e.date);
            const badge = TYPE_BADGE[e.type];
            const urgent = days <= 7;

            return (
              <tr
                key={i}
                className="border-b transition-colors hover:bg-white/[0.02]"
                style={{ borderColor: "var(--border-faint, rgba(255,255,255,0.04))" }}
                title={e.description}
              >
                <td className="py-2 pr-4 font-bold" style={{ color: "var(--text-primary)" }}>
                  {e.asset}
                </td>
                <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                  {e.date}
                </td>
                <td className="py-2 pr-4 text-right" style={{ color: "var(--text-secondary)" }}>
                  {fmtAmount(e.amount, e.amount_unit)}
                </td>
                <td className="py-2 pr-4 text-right" style={{ color: "var(--text-secondary)" }}>
                  {fmtUSD(e.usd_value_estimate)}
                </td>
                <td className="py-2 pr-4 text-center">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ color: badge.color, background: `${badge.color}22` }}
                  >
                    {badge.label}
                  </span>
                </td>
                <td
                  className="py-2 text-right font-semibold"
                  style={{ color: urgent ? "#ef4444" : "var(--text-muted)" }}
                >
                  {days}d
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
