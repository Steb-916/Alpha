"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { formatPrice } from "@/lib/utils";
import type { BacktestTrade } from "@/lib/analytics/backtest-engine";

const EXIT_LABELS: Record<string, string> = {
  stop_loss: "Stop Loss",
  take_profit: "Take Profit",
  metric_exit: "Signal",
  end_of_data: "End of Data",
};

export function TradeLog({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <GlassCard>
        <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          No trades generated with these conditions.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard noPadding>
      <div className="p-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
          TRADE LOG — {trades.length} trades
        </p>
      </div>
      <div className="overflow-x-auto max-h-56 overflow-y-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0" style={{ background: "var(--glass-bg-hover)" }}>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              {["Entry Date", "Entry Price", "Exit Date", "Exit Price", "P&L %", "Exit Reason"].map((h) => (
                <th key={h} className="py-1.5 px-3 text-left text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr
                key={i}
                style={{ borderBottom: "1px solid var(--glass-border)" }}
                className="hover:bg-white/[0.02]"
              >
                <td className="py-1.5 px-3" style={{ color: "var(--text-secondary)" }}>{t.entryDate}</td>
                <td className="py-1.5 px-3" style={{ color: "var(--text-primary)" }}>{formatPrice(t.entryPrice)}</td>
                <td className="py-1.5 px-3" style={{ color: "var(--text-secondary)" }}>{t.exitDate}</td>
                <td className="py-1.5 px-3" style={{ color: "var(--text-primary)" }}>{formatPrice(t.exitPrice)}</td>
                <td
                  className="py-1.5 px-3 font-semibold"
                  style={{ color: t.pnlPct >= 0 ? "var(--accent-green)" : "var(--data-red)" }}
                >
                  {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%
                </td>
                <td className="py-1.5 px-3">
                  <span
                    className="px-1.5 py-0.5 rounded-[var(--radius-pill)] text-[9px] uppercase tracking-wider"
                    style={{
                      background:
                        t.exitReason === "stop_loss"
                          ? "rgba(239,68,68,0.15)"
                          : t.exitReason === "take_profit"
                            ? "rgba(16,185,129,0.15)"
                            : "var(--glass-bg)",
                      color:
                        t.exitReason === "stop_loss"
                          ? "var(--data-red)"
                          : t.exitReason === "take_profit"
                            ? "var(--accent-green)"
                            : "var(--text-muted)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {EXIT_LABELS[t.exitReason] ?? t.exitReason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
